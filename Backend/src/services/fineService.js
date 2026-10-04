import Fine from '../models/Fine.js'
import Student from '../models/Student.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { overdueDays } from '../utils/dateUtils.js'
import { getSettings } from './settingsService.js'
import { recordAudit } from './auditService.js'
import { createNotification } from './notificationService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { getModelById } from './resourceService.js'
import { STAFF_ROLES } from '../config/constants.js'

export function calculateFine(daysLate, dailyFineAmount) {
  const daysOverdue = Math.max(0, Math.floor(daysLate))
  return { daysOverdue, amount: daysOverdue * dailyFineAmount }
}

export async function createFine({ student, circulation, session }) {
  const settings = await getSettings(session)
  const daysOverdue = overdueDays(circulation.dueDate, new Date(), settings.timezone)
  const { amount } = calculateFine(daysOverdue, settings.dailyFineAmount)
  if (!amount) return null
  const [fine] = await Fine.create([{
    fineId: `FINE-${Date.now().toString(36).toUpperCase()}`,
    studentId: student._id,
    circulationId: circulation._id,
    bookTitleId: circulation.bookTitleId,
    bookCopyId: circulation.bookCopyId,
    daysOverdue,
    amount,
    remainingAmount: amount,
  }], { session })
  student.outstandingFine += amount
  await student.save({ session })
  await createNotification({
    student, type: 'FINE_CREATED', title: 'Overdue fine created',
    message: `A fine of ${amount} has been added for an overdue return.`,
    entityType: 'Fine', entityId: fine._id, session,
  })
  return fine
}

export async function listFines(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  for (const key of ['studentId', 'status']) if (query[key]) filter[key] = query[key]
  const [data, total] = await Promise.all([
    Fine.find(filter).populate('studentId', 'studentId registerNumber name').populate('circulationId').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Fine.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export function getFine(id) {
  return getModelById(Fine, id, { populate: ['studentId', 'circulationId', 'bookTitleId', 'bookCopyId'] })
}

export async function getFineForUser(id, user) {
  const fine = await getFine(id)
  if (!STAFF_ROLES.includes(user.role)) {
    const student = await Student.findOne({ userId: user._id }).select('_id')
    if (!student || String(fine.studentId._id) !== String(student._id)) throw ApiError.forbidden()
  }
  return fine
}

export async function payFine(id, amount, user, req, payment = {}) {
  return withTransaction(async (session) => {
    const fine = await Fine.findById(id).session(session)
    if (!fine) throw ApiError.notFound('Fine not found.')
    if (!STAFF_ROLES.includes(user.role)) {
      const student = await Student.findOne({ userId: user._id }).session(session)
      if (!student || String(fine.studentId) !== String(student._id)) throw ApiError.forbidden()
    }
    if (!Number.isFinite(amount) || amount <= 0) throw ApiError.badRequest('Payment amount must be greater than zero.')
    if (amount > fine.remainingAmount) throw ApiError.badRequest('Payment exceeds the remaining fine amount.')
    fine.paidAmount += amount
    fine.remainingAmount = Math.max(0, fine.amount - fine.paidAmount)
    fine.status = fine.remainingAmount === 0 ? 'PAID' : 'PARTIALLY_PAID'
    if (fine.status === 'PAID') fine.paidAt = new Date()
    fine.paymentHistory.push({
      amount,
      paymentMethod: payment.paymentMethod || 'CASH',
      paymentReference: payment.paymentReference,
      paidAt: new Date(),
      paidBy: user._id,
    })
    await fine.save({ session })
    const student = await Student.findById(fine.studentId).session(session)
    if (!student) throw ApiError.conflict('Fine student record is missing.')
    student.outstandingFine = Math.max(0, student.outstandingFine - amount)
    await student.save({ session })
    await createNotification({
      student, type: 'FINE_PAID', title: 'Fine payment recorded',
      message: `A payment of ${amount} has been recorded for your fine.`,
      entityType: 'Fine', entityId: fine._id, session,
    })
    await recordAudit({
      action: 'FINE_PAID', entityType: 'Fine', entityId: fine._id,
      user, req, session, description: `Recorded fine payment of ${amount}.`, metadata: { amount },
    })
    return fine
  })
}

export async function reverseFinePayment(id, paymentId, reason, user, req) {
  return withTransaction(async (session) => {
    const fine = await Fine.findById(id).session(session)
    if (!fine) throw ApiError.notFound('Fine not found.')
    const payment = fine.paymentHistory.id(paymentId)
    if (!payment || payment.reversedAt) throw ApiError.notFound('Active fine payment not found.')
    if (fine.status === 'WAIVED') throw ApiError.conflict('A waived fine payment cannot be reversed.')
    payment.reversedAt = new Date()
    payment.reversedBy = user._id
    payment.reversalReason = reason
    fine.paidAmount = Math.max(0, fine.paidAmount - payment.amount)
    fine.remainingAmount = Math.max(0, fine.amount - fine.paidAmount)
    fine.status = fine.paidAmount === 0 ? 'PENDING' : 'PARTIALLY_PAID'
    fine.paidAt = undefined
    await fine.save({ session })
    const student = await Student.findById(fine.studentId).session(session)
    if (student) {
      student.outstandingFine += payment.amount
      await student.save({ session })
    }
    await recordAudit({
      action: 'FINE_PAYMENT_REVERSED', entityType: 'Fine', entityId: fine._id,
      user, req, session, description: `Reversed a payment for fine ${fine.fineId}.`,
      metadata: { paymentId, amount: payment.amount, reason },
    })
    return fine
  })
}

export async function waiveFine(id, reason, user, req) {
  return withTransaction(async (session) => {
    const fine = await Fine.findById(id).session(session)
    if (!fine) throw ApiError.notFound('Fine not found.')
    if (fine.status === 'PAID' || fine.status === 'WAIVED') throw ApiError.conflict('This fine cannot be waived.')
    const student = await Student.findById(fine.studentId).session(session)
    const remainingAmount = fine.remainingAmount
    fine.status = 'WAIVED'
    fine.waivedAt = new Date()
    fine.waivedBy = user._id
    fine.waiverReason = reason
    fine.remainingAmount = 0
    await fine.save({ session })
    if (student) {
      student.outstandingFine = Math.max(0, student.outstandingFine - remainingAmount)
      await student.save({ session })
    }
    await recordAudit({
      action: 'FINE_WAIVED', entityType: 'Fine', entityId: fine._id,
      user, req, session, description: `Waived fine ${fine.fineId}.`, metadata: { reason },
    })
    return fine
  })
}

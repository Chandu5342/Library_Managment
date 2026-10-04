import Circulation from '../models/Circulation.js'
import Student from '../models/Student.js'
import BookCopy from '../models/BookCopy.js'
import BookTitle from '../models/BookTitle.js'
import Reservation from '../models/Reservation.js'
import ApiError from '../utils/ApiError.js'
import { addDays, overdueDays } from '../utils/dateUtils.js'
import { getPagination } from '../utils/pagination.js'
import { normalizeRfid } from './rfidService.js'
import { getSettings } from './settingsService.js'
import { createNotification } from './notificationService.js'
import { createFine } from './fineService.js'
import { processReservationQueue } from './reservationService.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { STAFF_ROLES } from '../config/constants.js'
import mongoose from 'mongoose'

export async function validateIssueEligibility({ studentId, bookCopyId, bookRfid, reservationId }, session) {
  const [student, copy, settings] = await Promise.all([
    Student.findOne({ _id: studentId, isActive: true }).session(session),
    BookCopy.findOne(mongoose.isValidObjectId(bookCopyId)
      ? { $or: [{ _id: bookCopyId }, { copyId: bookCopyId }], isActive: true }
      : { copyId: bookCopyId, isActive: true }).session(session),
    getSettings(session),
  ])
  if (!student) throw ApiError.notFound('Student not found.')
  if (!copy) throw ApiError.notFound('Book copy not found.')
  if (normalizeRfid(copy.rfidUid) !== normalizeRfid(bookRfid)) throw ApiError.badRequest('Scanned RFID does not match this book copy.')
  if (student.status !== 'ACTIVE' || student.membershipStatus !== 'ACTIVE') throw ApiError.badRequest('Student membership is not active.')
  const memberRule = settings.memberTypeRules?.[student.memberType] || {}
  const configuredLimit = Number(memberRule.borrowingLimit ?? settings.maximumBooksPerStudent)
  const limit = Math.min(configuredLimit, student.maximumBooksAllowed ?? configuredLimit)
  if (student.currentBooksCount >= limit) throw ApiError.badRequest('Student has reached the borrowing limit.')
  const hasOverdue = await Circulation.exists({
    studentId, status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() },
  }).session(session)
  if (settings.blockBorrowingWithOverdueBooks && hasOverdue) throw ApiError.badRequest('Student has overdue books and cannot borrow another book.')
  if (settings.blockBorrowingWithUnpaidFines && student.outstandingFine >= settings.blockingFineAmount && student.outstandingFine > 0) {
    throw ApiError.badRequest('Student has unpaid fines and borrowing is blocked.')
  }
  if (!['AVAILABLE', 'RESERVED'].includes(copy.status)) {
    throw ApiError.conflict(`Book copy is ${copy.status.toLowerCase().replace('_', ' ')} and cannot be issued.`)
  }
  if (copy.condition === 'DAMAGED' || copy.condition === 'LOST') throw ApiError.badRequest(`Book copy condition is ${copy.condition.toLowerCase()}.`)
  if (await Circulation.exists({ bookCopyId: copy._id, status: { $in: ['ISSUED', 'OVERDUE'] } }).session(session)) {
    throw ApiError.conflict('Book copy already has an active circulation record.')
  }
  if (await Circulation.exists({ studentId, bookTitleId: copy.bookTitleId, status: { $in: ['ISSUED', 'OVERDUE'] } }).session(session)) {
    throw ApiError.conflict('This student already has an unreturned copy of this book.')
  }
  let reservation
  if (copy.status === 'RESERVED') {
    reservation = await Reservation.findOne({
      _id: reservationId || undefined,
      preferredCopyId: copy._id,
      studentId,
      status: 'READY_FOR_PICKUP',
      expiresAt: { $gt: new Date() },
    }).session(session)
    if (!reservation) throw ApiError.conflict('This copy is reserved for another student.')
  } else {
    const waiting = await Reservation.findOne({ bookTitleId: copy.bookTitleId, status: 'PENDING' }).sort({ queuePosition: 1 }).session(session)
    if (waiting && String(waiting.studentId) !== String(studentId)) {
      throw ApiError.conflict('This title has a reservation queue and must be offered to the next student.')
    }
    if (waiting && String(waiting.studentId) === String(studentId)) reservation = waiting
  }
  const title = await BookTitle.findById(copy.bookTitleId).session(session)
  if (!title?.isActive) throw ApiError.notFound('Book title is unavailable.')
  return {
    student, copy, title, settings, reservation,
    loanPeriodDays: Number(memberRule.loanPeriodDays ?? settings.defaultLoanPeriodDays),
    borrowingLimit: limit,
  }
}

export async function issueBook(payload, user, req) {
  return withTransaction(async (session) => {
    const { student, copy, title, reservation, loanPeriodDays } = await validateIssueEligibility(payload, session)
    if (copy.status === 'AVAILABLE') {
      const claimed = await BookCopy.findOneAndUpdate(
        { _id: copy._id, status: 'AVAILABLE' },
        { $set: { status: 'ISSUED', currentHolderId: student._id, lastIssuedAt: new Date() } },
        { new: true, session },
      )
      if (!claimed) throw ApiError.conflict('Book copy was issued by another request. Please rescan.')
    } else {
      copy.status = 'ISSUED'
      copy.currentHolderId = student._id
      copy.lastIssuedAt = new Date()
      await copy.save({ session })
    }
    const issueDate = new Date()
    const dueDate = addDays(issueDate, loanPeriodDays)
    const [circulation] = await Circulation.create([{
      transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
      studentId: student._id,
      bookTitleId: title._id,
      bookCopyId: copy._id,
      bookRfid: copy.rfidUid,
      issuedBy: user?._id,
      issueDate,
      dueDate,
      status: 'ISSUED',
      conditionAtIssue: copy.condition,
    }], { session })
    copy.currentCirculationId = circulation._id
    await copy.save({ session })
    if (reservation) {
      reservation.status = 'COMPLETED'
      reservation.fulfilledAt = issueDate
      await reservation.save({ session })
      if (copy.status === 'ISSUED' && reservation.preferredCopyId) {
        title.reservedCopies = Math.max(0, title.reservedCopies - 1)
      }
    } else {
      title.availableCopies = Math.max(0, title.availableCopies - 1)
    }
    title.issuedCopies += 1
    await title.save({ session })
    student.currentBooksCount += 1
    student.totalBooksIssued += 1
    await student.save({ session })
    await createNotification({
      student, type: 'BOOK_ISSUED', title: 'Book issued',
      message: `"${title.title}" is due on ${dueDate.toISOString().slice(0, 10)}.`,
      entityType: 'Circulation', entityId: circulation._id, session,
    })
    await recordAudit({
      action: 'BOOK_ISSUED', entityType: 'Circulation', entityId: circulation._id,
      user, req, session, description: `Issued ${title.title} (${copy.copyId}) to ${student.name}.`,
    })
    return { circulation, student, book: title, bookCopy: copy, fine: null }
  })
}

export async function returnBook({ studentId, bookRfid, conditionAtReturn }, user, req) {
  return withTransaction(async (session) => {
    const copy = await BookCopy.findOne({ rfidUid: normalizeRfid(bookRfid), isActive: true }).session(session)
    if (!copy) throw ApiError.notFound('No registered book copy matches this RFID.')
    if (!copy.currentCirculationId) throw ApiError.conflict('This book copy has no active circulation.')
    const circulation = await Circulation.findOne({
      _id: copy.currentCirculationId, status: { $in: ['ISSUED', 'OVERDUE'] },
    }).session(session)
    if (!circulation) throw ApiError.conflict('Active circulation record was not found.')
    if (String(circulation.studentId) !== String(studentId) || String(copy.currentHolderId) !== String(studentId)) {
      throw ApiError.forbidden('This book is currently issued to another student.')
    }
    const [student, title] = await Promise.all([
      Student.findById(studentId).session(session),
      BookTitle.findById(copy.bookTitleId).session(session),
    ])
    const settings = await getSettings(session)
    if (!student || !title) throw ApiError.conflict('The circulation relationship is incomplete.')
    const returnedAt = new Date()
    const lateDays = overdueDays(circulation.dueDate, returnedAt, settings.timezone)
    const fine = lateDays > 0 ? await createFine({ student, circulation, session }) : null
    circulation.returnDate = returnedAt
    circulation.returnedBy = user?._id
    const returnedCondition = conditionAtReturn?.toUpperCase().replaceAll(' ', '_') || copy.condition
    circulation.status = returnedCondition === 'DAMAGED' ? 'DAMAGED' : returnedCondition === 'LOST' ? 'LOST' : 'RETURNED'
    circulation.conditionAtReturn = returnedCondition === 'UNDER_REPAIR' ? 'FAIR' : returnedCondition
    if (fine) circulation.fineId = fine._id
    await circulation.save({ session })
    copy.currentHolderId = undefined
    copy.currentCirculationId = undefined
    copy.lastReturnedAt = returnedAt
    if (returnedCondition !== 'UNDER_REPAIR') copy.condition = returnedCondition
    copy.status = returnedCondition === 'UNDER_REPAIR' ? 'UNDER_REPAIR'
      : returnedCondition === 'DAMAGED' ? 'DAMAGED'
        : returnedCondition === 'LOST' ? 'LOST' : 'AVAILABLE'
    await copy.save({ session })
    title.issuedCopies = Math.max(0, title.issuedCopies - 1)
    student.currentBooksCount = Math.max(0, student.currentBooksCount - 1)
    student.totalBooksReturned += 1
    student.overdueBooksCount = await Circulation.countDocuments({
      studentId, status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: returnedAt },
    }).session(session)
    if (copy.status === 'DAMAGED') title.damagedCopies += 1
    else if (copy.status === 'LOST') title.lostCopies += 1
    else if (copy.status === 'UNDER_REPAIR') title.underRepairCopies += 1
    else title.availableCopies += 1
    await Promise.all([title.save({ session }), student.save({ session })])
    let nextReservation = null
    if (copy.status === 'AVAILABLE') {
      nextReservation = await processReservationQueue(title._id, copy._id, session, user, req)
    }
    await createNotification({
      student, type: 'BOOK_RETURNED', title: 'Book returned',
      message: `"${title.title}" was returned successfully${lateDays ? `; ${lateDays} overdue day(s) were recorded` : ''}.`,
      entityType: 'Circulation', entityId: circulation._id, session,
    })
    await recordAudit({
      action: 'BOOK_RETURNED', entityType: 'Circulation', entityId: circulation._id,
      user, req, session, description: `Returned ${title.title} (${copy.copyId}) from ${student.name}.`,
      metadata: { overdueDays: lateDays, fineId: fine?._id },
    })
    return {
      circulation, student, book: title, bookCopy: copy, fine, overdueDays: lateDays,
      nextReservation,
    }
  })
}

export async function renewBook(circulationId, user, req) {
  return withTransaction(async (session) => {
    const circulation = await Circulation.findOne({ _id: circulationId, status: { $in: ['ISSUED', 'OVERDUE'] } }).session(session)
    if (!circulation) throw ApiError.notFound('Active circulation not found.')
    const [student, title, settings, activeReservations] = await Promise.all([
      Student.findById(circulation.studentId).session(session),
      BookTitle.findById(circulation.bookTitleId).session(session),
      getSettings(session),
      Reservation.exists({ bookTitleId: circulation.bookTitleId, status: { $in: ['PENDING', 'READY_FOR_PICKUP'] } }).session(session),
    ])
    if (!STAFF_ROLES.includes(user.role)) {
      if (!student || String(student.userId) !== String(user._id)) throw ApiError.forbidden()
    }
    if (!settings.allowRenewals) throw ApiError.badRequest('Renewals are currently disabled.')
    if (circulation.renewalCount >= settings.maximumRenewals) throw ApiError.badRequest('Maximum renewals reached.')
    if (activeReservations && !settings.allowRenewalWithReservations) throw ApiError.conflict('This title has an active reservation; renewal is not allowed.')
    const from = circulation.dueDate > new Date() ? circulation.dueDate : new Date()
    const memberRule = settings.memberTypeRules?.[student?.memberType] || {}
    circulation.dueDate = addDays(from, Number(memberRule.loanPeriodDays ?? settings.defaultLoanPeriodDays))
    circulation.renewalCount += 1
    circulation.status = 'ISSUED'
    await circulation.save({ session })
    await recordAudit({
      action: 'BOOK_RENEWED', entityType: 'Circulation', entityId: circulation._id,
      user, req, session, description: `Renewed circulation ${circulation.transactionId}.`,
      metadata: { dueDate: circulation.dueDate },
    })
    return { circulation, dueDate: circulation.dueDate, title }
  })
}

export async function validateIssue(payload) {
  const eligibility = await validateIssueEligibility(payload, null)
  return {
    eligible: true,
    book: eligibility.title,
    copy: eligibility.copy,
    student: eligibility.student,
    dueDate: addDays(new Date(), eligibility.loanPeriodDays),
    loanDays: eligibility.loanPeriodDays,
    borrowingLimit: eligibility.borrowingLimit,
    outstandingFine: eligibility.student.outstandingFine,
  }
}

export async function listCirculation(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  if (query.status) filter.status = query.status.toUpperCase()
  if (query.studentId) filter.studentId = query.studentId
  if (query.bookCopyId) filter.bookCopyId = query.bookCopyId
  if (query.bookTitleId) filter.bookTitleId = query.bookTitleId
  if (query.overdue === 'true') filter.dueDate = { $lt: new Date() }, filter.status = { $in: ['ISSUED', 'OVERDUE'] }
  if (query.from || query.to) filter.issueDate = {}
  if (query.from) filter.issueDate.$gte = new Date(query.from)
  if (query.to) filter.issueDate.$lte = new Date(query.to)
  if (query.search) {
    const regex = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const [students, copies] = await Promise.all([
      Student.find({ $or: [{ name: regex }, { registerNumber: regex }, { studentId: regex }] }).select('_id'),
      BookCopy.find({ $or: [{ copyId: regex }, { rfidUid: regex }] }).select('_id'),
    ])
    filter.$or = [
      { studentId: { $in: students.map((item) => item._id) } },
      { bookCopyId: { $in: copies.map((item) => item._id) } },
      { transactionId: regex },
    ]
  }
  const sort = query.sort === 'dueDate' ? { dueDate: 1 } : { issueDate: -1 }
  const [data, total] = await Promise.all([
    Circulation.find(filter).populate('studentId').populate('bookTitleId').populate('bookCopyId').sort(sort).skip(skip).limit(limit),
    Circulation.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function getCirculation(id, user) {
  const record = await Circulation.findById(id).populate('studentId').populate('bookTitleId').populate('bookCopyId').populate('fineId')
  if (record && user && !STAFF_ROLES.includes(user.role)) {
    const student = await Student.findOne({ userId: user._id }).select('_id')
    if (!student || String(record.studentId?._id) !== String(student._id)) throw ApiError.forbidden()
  }
  return record
}

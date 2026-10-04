import Reservation from '../models/Reservation.js'
import Student from '../models/Student.js'
import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import ApiError from '../utils/ApiError.js'
import { addDays } from '../utils/dateUtils.js'
import { getPagination } from '../utils/pagination.js'
import { getSettings } from './settingsService.js'
import { createNotification } from './notificationService.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { getModelById } from './resourceService.js'
import { STAFF_ROLES } from '../config/constants.js'

export async function createReservation({ studentId, bookTitleId, notes }, user, req) {
  return withTransaction(async (session) => {
    const resolvedStudentId = !STAFF_ROLES.includes(user.role)
      ? (await Student.findOne({ userId: user._id }).session(session))?._id
      : studentId
    const [student, title, settings] = await Promise.all([
      Student.findOne({ _id: resolvedStudentId, isActive: true }).session(session),
      BookTitle.findOne({ _id: bookTitleId, isActive: true }).session(session),
      getSettings(session),
    ])
    if (!student) throw ApiError.notFound('Student not found.')
    if (!title) throw ApiError.notFound('Book title not found.')
    if (student.status !== 'ACTIVE' || student.membershipStatus !== 'ACTIVE') throw ApiError.badRequest('Student membership is not active.')
    const count = await Reservation.countDocuments({
      studentId: student._id, status: { $in: ['PENDING', 'READY_FOR_PICKUP'] },
    }).session(session)
    if (count >= settings.maximumReservationsPerStudent) throw ApiError.badRequest('Student has reached the reservation limit.')
    if (await Reservation.exists({ studentId: student._id, bookTitleId, status: { $in: ['PENDING', 'READY_FOR_PICKUP'] } }).session(session)) {
      throw ApiError.conflict('Student already has an active reservation for this title.')
    }
    const existing = await Reservation.findOne({
      bookTitleId, status: { $in: ['PENDING', 'READY_FOR_PICKUP'] },
    }).sort({ queuePosition: -1 }).session(session)
    if (title.availableCopies > 0 && !existing) {
      throw ApiError.conflict('A copy is currently available; reservation is only available when copies are unavailable or a queue already exists.')
    }
    const reservation = await Reservation.create([{
      reservationId: `RES-${Date.now().toString(36).toUpperCase()}`,
      studentId: student._id, bookTitleId, queuePosition: (existing?.queuePosition || 0) + 1, notes,
    }], { session }).then(([value]) => value)
    await createNotification({
      student, type: 'RESERVATION_CREATED', title: 'Reservation placed',
      message: `Your reservation for "${title.title}" has been placed.`,
      entityType: 'Reservation', entityId: reservation._id, session,
    })
    await recordAudit({
      action: 'RESERVATION_CREATED', entityType: 'Reservation', entityId: reservation._id,
      user, req, session, description: `Created reservation for ${title.title}.`,
    })
    if (title.availableCopies > 0) {
      const availableCopy = await BookCopy.findOne({ bookTitleId: title._id, status: 'AVAILABLE', isActive: true }).sort({ copyId: 1 }).session(session)
      if (availableCopy) {
        await processReservationQueue(title._id, availableCopy._id, session, user, req)
      }
    }
    return Reservation.findById(reservation._id).session(session)
  })
}

export async function cancelReservation(id, user, req) {
  return withTransaction(async (session) => {
    const reservation = await Reservation.findById(id).session(session)
    if (!reservation) throw ApiError.notFound('Reservation not found.')
    if (!STAFF_ROLES.includes(user.role)) {
      const student = await Student.findOne({ userId: user._id }).session(session)
      if (!student || String(student._id) !== String(reservation.studentId)) throw ApiError.forbidden()
    }
    if (!['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status)) throw ApiError.conflict('This reservation can no longer be cancelled.')
    if (reservation.status === 'READY_FOR_PICKUP' && reservation.preferredCopyId) {
      const copy = await BookCopy.findOneAndUpdate(
        { _id: reservation.preferredCopyId, status: 'RESERVED' },
        { status: 'AVAILABLE' },
        { new: true, session },
      )
      if (copy) {
        await BookTitle.updateOne({ _id: reservation.bookTitleId }, { $inc: { availableCopies: 1, reservedCopies: -1 } }, { session })
      }
    }
    reservation.status = 'CANCELLED'
    reservation.cancelledAt = new Date()
    reservation.cancelledBy = user._id
    await reservation.save({ session })
    const [student, title] = await Promise.all([
      Student.findById(reservation.studentId).session(session),
      BookTitle.findById(reservation.bookTitleId).session(session),
    ])
    await createNotification({
      student,
      type: 'RESERVATION_CANCELLED',
      title: 'Reservation cancelled',
      message: `Your reservation for "${title?.title || 'a book'}" has been cancelled.`,
      entityType: 'Reservation',
      entityId: reservation._id,
      session,
    })
    await recordAudit({
      action: 'RESERVATION_CANCELLED', entityType: 'Reservation', entityId: reservation._id,
      user, req, session, description: `Cancelled reservation ${reservation.reservationId}.`,
    })
    if (reservation.preferredCopyId) {
      const copy = await BookCopy.findById(reservation.preferredCopyId).session(session)
      if (copy?.status === 'AVAILABLE') {
        await processReservationQueue(reservation.bookTitleId, copy._id, session, user, req)
      }
    }
    return reservation
  })
}

export async function rejectReservation(id, reason, user, req) {
  return withTransaction(async (session) => {
    const reservation = await Reservation.findById(id).session(session)
    if (!reservation) throw ApiError.notFound('Reservation not found.')
    if (!['PENDING', 'READY_FOR_PICKUP'].includes(reservation.status)) {
      throw ApiError.conflict('Only pending or ready reservations can be rejected.')
    }
    const copyId = reservation.status === 'READY_FOR_PICKUP' ? reservation.preferredCopyId : null
    reservation.status = 'REJECTED'
    reservation.rejectedAt = new Date()
    reservation.rejectedBy = user._id
    reservation.rejectionReason = reason?.trim() || undefined
    await reservation.save({ session })
    if (copyId) {
      const copy = await BookCopy.findOneAndUpdate(
        { _id: copyId, status: 'RESERVED' },
        { $set: { status: 'AVAILABLE' } },
        { new: true, session },
      )
      if (copy) {
        await BookTitle.updateOne(
          { _id: reservation.bookTitleId },
          { $inc: { availableCopies: 1, reservedCopies: -1 } },
          { session },
        )
        await processReservationQueue(reservation.bookTitleId, copy._id, session, user, req)
      }
    }
    const [student, title] = await Promise.all([
      Student.findById(reservation.studentId).session(session),
      BookTitle.findById(reservation.bookTitleId).session(session),
    ])
    await createNotification({
      student,
      type: 'RESERVATION_REJECTED',
      title: 'Reservation rejected',
      message: `Your reservation for "${title?.title || 'a book'}" was rejected.${reservation.rejectionReason ? ` Reason: ${reservation.rejectionReason}` : ''}`,
      entityType: 'Reservation',
      entityId: reservation._id,
      session,
    })
    await recordAudit({
      action: 'RESERVATION_REJECTED',
      entityType: 'Reservation',
      entityId: reservation._id,
      user,
      req,
      session,
      description: `Rejected reservation ${reservation.reservationId}.`,
      metadata: { reason: reservation.rejectionReason },
    })
    return reservation
  })
}

export async function processReservationQueue(bookTitleId, copyId, session, user, req) {
  const reservation = await Reservation.findOne({ bookTitleId, status: 'PENDING' }).sort({ queuePosition: 1, requestDate: 1 }).session(session)
  if (!reservation) return null
  const settings = await getSettings(session)
  reservation.status = 'READY_FOR_PICKUP'
  reservation.preferredCopyId = copyId
  reservation.readyAt = new Date()
  reservation.expiresAt = addDays(new Date(), settings.reservationPickupDays)
  await reservation.save({ session })
  const [copy, title, student] = await Promise.all([
    BookCopy.findById(copyId).session(session),
    BookTitle.findById(bookTitleId).session(session),
    Student.findById(reservation.studentId).session(session),
  ])
  if (!copy || !title || !student) throw ApiError.conflict('Reservation relationship is incomplete.')
  copy.status = 'RESERVED'
  await copy.save({ session })
  title.availableCopies = Math.max(0, title.availableCopies - 1)
  title.reservedCopies += 1
  await title.save({ session })
  await createNotification({
    student, type: 'RESERVATION_READY', title: 'Reserved book ready for pickup',
    message: `"${title.title}" is ready for pickup until ${reservation.expiresAt.toISOString()}.`,
    entityType: 'Reservation', entityId: reservation._id, session,
  })
  await recordAudit({
    action: 'RESERVATION_READY', entityType: 'Reservation', entityId: reservation._id,
    user, req, session, description: `Reservation ${reservation.reservationId} is ready for pickup.`,
  })
  return reservation
}

export async function fulfillReservation(id, user, req, issueBook) {
  const reservation = await getModelById(Reservation, id, { populate: ['studentId', 'preferredCopyId'] })
  if (reservation.status !== 'READY_FOR_PICKUP' || !reservation.preferredCopyId) {
    throw ApiError.conflict('Reservation is not ready for pickup.')
  }
  return issueBook({
    studentId: reservation.studentId._id,
    bookCopyId: reservation.preferredCopyId._id,
    bookRfid: reservation.preferredCopyId.rfidUid,
    reservationId: reservation._id,
  }, user, req)
}

export async function approveReservation(id, user, req) {
  return withTransaction(async (session) => {
    const reservation = await Reservation.findOne({ _id: id, status: 'PENDING' }).session(session)
    if (!reservation) throw ApiError.notFound('Pending reservation not found.')
    const next = await Reservation.findOne({
      bookTitleId: reservation.bookTitleId,
      status: 'PENDING',
    }).sort({ queuePosition: 1, requestDate: 1 }).session(session)
    if (String(next?._id) !== String(reservation._id)) {
      throw ApiError.conflict('Only the next reservation in the title queue can be approved.')
    }
    const copy = await BookCopy.findOne({
      bookTitleId: reservation.bookTitleId,
      status: 'AVAILABLE',
      isActive: true,
    }).sort({ copyId: 1 }).session(session)
    if (!copy) throw ApiError.conflict('No available copy can be assigned to this reservation.')
    const readyReservation = await processReservationQueue(reservation.bookTitleId, copy._id, session, user, req)
    if (readyReservation && String(readyReservation._id) === String(reservation._id)) {
      readyReservation.approvedAt = new Date()
      readyReservation.approvedBy = user._id
      await readyReservation.save({ session })
    }
    return readyReservation
  })
}

export async function expireReservation(id, user, req) {
  return withTransaction(async (session) => {
    const reservation = await Reservation.findById(id).session(session)
    if (!reservation) throw ApiError.notFound('Reservation not found.')
    if (reservation.status !== 'READY_FOR_PICKUP' || !reservation.expiresAt || reservation.expiresAt > new Date()) {
      throw ApiError.conflict('Reservation is not eligible for expiry.')
    }
    const copyId = reservation.preferredCopyId
    reservation.status = 'EXPIRED'
    await reservation.save({ session })
    if (copyId) {
      const copy = await BookCopy.findById(copyId).session(session)
      if (copy?.status === 'RESERVED') {
        copy.status = 'AVAILABLE'
        await copy.save({ session })
        await BookTitle.updateOne({ _id: reservation.bookTitleId }, { $inc: { availableCopies: 1, reservedCopies: -1 } }, { session })
        await processReservationQueue(reservation.bookTitleId, copy._id, session, user, req)
      }
    }
    const [student, title] = await Promise.all([
      Student.findById(reservation.studentId).session(session),
      BookTitle.findById(reservation.bookTitleId).session(session),
    ])
    await createNotification({
      student, type: 'RESERVATION_EXPIRED', title: 'Reservation expired',
      message: `Your reservation for "${title?.title || 'a book'}" has expired.`,
      entityType: 'Reservation', entityId: reservation._id, session,
    })
    await recordAudit({
      action: 'RESERVATION_EXPIRED', entityType: 'Reservation', entityId: reservation._id,
      user, req, session, description: `Expired reservation ${reservation.reservationId}.`,
    })
    return reservation
  })
}

export async function listReservations(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  for (const key of ['status', 'studentId', 'bookTitleId']) if (query[key]) filter[key] = query[key]
  const [data, total] = await Promise.all([
    Reservation.find(filter)
      .populate('studentId', 'studentId registerNumber name rfidUid department branch year section email currentBooksCount maximumBooksAllowed status membershipStatus outstandingFine userId')
      .populate('bookTitleId', 'title authors category subcategory department edition publicationYear totalCopies availableCopies issuedCopies reservedCopies damagedCopies lostCopies underRepairCopies')
      .populate({ path: 'preferredCopyId', populate: [{ path: 'currentHolderId', select: 'studentId registerNumber name' }, { path: 'currentCirculationId', select: 'dueDate status' }] })
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ requestDate: -1 }).skip(skip).limit(limit),
    Reservation.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function getReservation(id) {
  return getModelById(Reservation, id, { populate: ['studentId', 'bookTitleId', 'preferredCopyId'] })
}

export function reservationsForBook(bookTitleId, query) {
  return listReservations({ ...query, bookTitleId })
}

export function reservationsForStudent(studentId, query) {
  return listReservations({ ...query, studentId })
}

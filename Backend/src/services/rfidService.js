import crypto from 'node:crypto'
import BookCopy from '../models/BookCopy.js'
import Student from '../models/Student.js'
import ApiError from '../utils/ApiError.js'
import RfidRegistry from '../models/RfidRegistry.js'
import Reservation from '../models/Reservation.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { normalizeRfid } from '../utils/rfid.js'

export { normalizeRfid }

export function formatRfid(value) {
  const normalized = normalizeRfid(value)
  return /^[A-F0-9]{8}$/.test(normalized) ? normalized.match(/.{2}/g).join(' ') : normalized
}

export function validateRfid(value) {
  const normalized = normalizeRfid(value)
  return /^[A-F0-9]{8}$/.test(normalized) || /^RFID(?:BOOK[A-Z0-9]{6}|MEMBER\d{6})$/.test(normalized)
}

export async function generateUniqueRfid(_model = BookCopy, session) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = crypto.randomBytes(4).toString('hex').toUpperCase()
    const [book, student, registered] = await Promise.all([
      BookCopy.exists({ rfidUid: candidate }).session(session || null),
      Student.exists({ rfidUid: candidate }).session(session || null),
      RfidRegistry.exists({ rfidUid: candidate }).session(session || null),
    ])
    if (!book && !student && !registered) return formatRfid(candidate)
  }
  throw ApiError.conflict('Unable to generate a unique RFID. Please retry.')
}

export async function getRfidUsage() {
  const [copies, students, registered] = await Promise.all([
    BookCopy.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: true }),
    RfidRegistry.countDocuments(),
  ])
  return { copies, students, registered }
}

export async function claimRfid(rfid, entityType, entityId, session) {
  const normalized = normalizeRfid(rfid)
  const [copy, student, owner] = await Promise.all([
    BookCopy.exists({
      rfidUid: normalized,
      ...(entityType === 'BOOK_COPY' ? { _id: { $ne: entityId } } : {}),
    }).session(session || null),
    Student.exists({
      rfidUid: normalized,
      ...(entityType === 'STUDENT' ? { _id: { $ne: entityId } } : {}),
    }).session(session || null),
    RfidRegistry.findOne({ rfidUid: normalized }).session(session || null),
  ])
  if (copy || student || (owner && (owner.entityType !== entityType || String(owner.entityId) !== String(entityId)))) {
    throw ApiError.conflict('RFID is already registered.')
  }
  if (!owner) {
    await RfidRegistry.create([{ rfidUid: normalized, entityType, entityId }], { session })
  }
}

export async function lookupBookRfid(rfid) {
  const normalized = normalizeRfid(rfid)
  const copy = await BookCopy.findOne({ rfidUid: normalized, isActive: true })
    .populate('bookTitleId')
    .populate('currentHolderId', 'studentId registerNumber name department year section')
    .populate('currentCirculationId')
  if (!copy) throw ApiError.notFound('No registered book copy matches this RFID.')
  return copy
}

export async function lookupStudentRfid(rfid) {
  const normalized = normalizeRfid(rfid)
  const student = await Student.findOne({ rfidUid: normalized, isActive: true })
  if (!student) throw ApiError.notFound('No active student matches this RFID.')
  return student
}

export async function findByRfid(rfid) {
  const normalized = normalizeRfid(rfid)
  if (!validateRfid(rfid)) throw ApiError.badRequest('RFID format is invalid.')
  const [copy, student] = await Promise.all([
    BookCopy.findOne({ rfidUid: normalized, isActive: true }).populate('bookTitleId').populate('currentHolderId', 'studentId registerNumber name'),
    Student.findOne({ rfidUid: normalized, isActive: true }),
  ])
  if (copy && student) throw ApiError.conflict('RFID is registered to more than one entity.')
  if (!copy && !student) throw ApiError.notFound('RFID is not registered.')
  if (copy) {
    const reservation = await Reservation.findOne({
      preferredCopyId: copy._id,
      status: 'READY_FOR_PICKUP',
    }).populate('studentId', 'studentId registerNumber name')
      || await Reservation.findOne({ bookTitleId: copy.bookTitleId, status: 'PENDING' }).sort({ queuePosition: 1 })
    return { type: 'BOOK_COPY', copy: { ...copy.toObject(), reservation } }
  }
  return { type: 'STUDENT', student }
}

export async function validateRfidValue(rfid) {
  const normalized = normalizeRfid(rfid)
  const valid = validateRfid(normalized)
  const [book, student, registry] = valid ? await Promise.all([
    BookCopy.exists({ rfidUid: normalized }),
    Student.exists({ rfidUid: normalized }),
    RfidRegistry.exists({ rfidUid: normalized }),
  ]) : [false, false, false]
  return {
    valid,
    registered: Boolean(book || student || registry),
    type: book ? 'BOOK_COPY' : student ? 'STUDENT' : registry?.entityType || null,
  }
}

export async function registerRfid({ type, id, rfid }, user, req) {
  const Model = type === 'STUDENT' ? Student : type === 'BOOK_COPY' ? BookCopy : null
  if (!Model) throw ApiError.badRequest('RFID type must be BOOK_COPY or STUDENT.')
  const normalized = normalizeRfid(rfid)
  if (!validateRfid(normalized)) throw ApiError.badRequest('RFID format is invalid.')
  return withTransaction(async (session) => {
    const entity = await Model.findById(id).session(session)
    if (!entity) throw ApiError.notFound('RFID entity not found.')
    entity.rfidUid = normalized
    await entity.save({ session })
    await claimRfid(normalized, type, entity._id, session)
    await recordAudit({
      action: 'RFID_REGISTERED',
      entityType: type === 'STUDENT' ? 'Student' : 'BookCopy',
      entityId: entity._id,
      user,
      req,
      session,
      description: `Registered RFID for ${type.toLowerCase()}.`,
    })
    return entity
  })
}

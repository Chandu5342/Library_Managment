import BookCopy from '../models/BookCopy.js'
import BookTitle from '../models/BookTitle.js'
import Circulation from '../models/Circulation.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { normalizeRfid, generateUniqueRfid, claimRfid } from './rfidService.js'
import { changeCopyStatus } from './inventoryService.js'
import { recordAudit } from './auditService.js'
import Reservation from '../models/Reservation.js'
import mongoose from 'mongoose'
import { withTransaction } from '../utils/withTransaction.js'

export async function listBookCopies(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = { isActive: true }
  if (query.status) filter.status = query.status.toUpperCase()
  if (query.bookTitleId) filter.bookTitleId = query.bookTitleId
  if (query.rfid) filter.rfidUid = normalizeRfid(query.rfid)
  if (query.search) {
    const regex = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matchingTitles = await BookTitle.find({
      $or: [
        { title: regex },
        { authors: regex },
        { isbn: regex },
        { bookId: regex },
        { category: regex },
        { subcategory: regex },
        { department: regex },
      ],
      isActive: true,
    }).select('_id')
    filter.$or = [
      { copyId: regex },
      { rfidUid: regex },
      { rfidUid: normalizeRfid(query.search) },
      { accessionNumber: regex },
      { barcode: regex },
      { bookTitleId: { $in: matchingTitles.map((title) => title._id) } },
    ]
  }
  const [data, total] = await Promise.all([
    BookCopy.find(filter)
      .populate('bookTitleId')
      .populate('currentHolderId', 'studentId registerNumber name department year section rfidUid')
      .populate('currentCirculationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BookCopy.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function getBookCopy(id) {
  const copy = await BookCopy.findOne(mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { copyId: id }] } : { copyId: id }).populate('bookTitleId').populate('currentHolderId', 'studentId registerNumber name department year section rfidUid').populate('currentCirculationId')
  if (!copy) throw ApiError.notFound('Book copy not found.')
  return copy
}

export async function createBookCopy(values, user, req) {
  return withTransaction(async (session) => {
    const title = await BookTitle.findOne({ _id: values.bookTitleId, isActive: true }).session(session)
    if (!title) throw ApiError.notFound('Book title not found.')
    const [copy] = await BookCopy.create([{
      ...values,
      copyId: values.copyId || `COPY-${Date.now().toString(36).toUpperCase()}`,
      rfidUid: normalizeRfid(values.rfidUid || await generateUniqueRfid(undefined, session)),
      status: String(values.status || 'AVAILABLE').toUpperCase(),
      condition: String(values.condition || 'GOOD').toUpperCase(),
    }], { session })
    await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id, session)
    title.totalCopies += 1
    const field = { AVAILABLE: 'availableCopies', ISSUED: 'issuedCopies', RESERVED: 'reservedCopies', DAMAGED: 'damagedCopies', LOST: 'lostCopies', UNDER_REPAIR: 'underRepairCopies' }[copy.status]
    if (field) title[field] += 1
    await title.save({ session })
    await recordAudit({ action: 'BOOK_COPY_CREATED', entityType: 'BookCopy', entityId: copy._id, user, req, session, description: `Registered physical copy ${copy.copyId}.` })
    return copy
  })
}

export async function updateBookCopy(id, values, user, req) {
  if (values.status) return changeCopyStatus(id, values.status, values.condition, user, req)
  return withTransaction(async (session) => {
    const copy = await BookCopy.findOne(mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { copyId: id }], isActive: true }
      : { copyId: id, isActive: true }).session(session)
    if (!copy) throw ApiError.notFound('Book copy not found.')
    Object.assign(copy, values)
    if (copy.rfidUid) {
      copy.rfidUid = normalizeRfid(copy.rfidUid)
      await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id, session)
    }
    await copy.save({ session })
    await recordAudit({ action: 'BOOK_COPY_UPDATED', entityType: 'BookCopy', entityId: copy._id, user, req, session, description: `Updated physical copy ${copy.copyId}.` })
    return copy
  })
}

export async function archiveBookCopy(id, user, req) {
  return withTransaction(async (session) => {
    const copy = await BookCopy.findOne(mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { copyId: id }], isActive: true }
      : { copyId: id, isActive: true }).session(session)
    if (!copy) throw ApiError.notFound('Book copy not found.')
    if (copy.status === 'RESERVED' && await Reservation.exists({ preferredCopyId: copy._id, status: 'READY_FOR_PICKUP' }).session(session)) {
      throw ApiError.conflict('Cannot archive a copy reserved for pickup.')
    }
    if (copy.currentCirculationId || await Circulation.exists({ bookCopyId: copy._id, status: { $in: ['ISSUED', 'OVERDUE'] } }).session(session)) {
      throw ApiError.conflict('Cannot archive a book copy with an active circulation.')
    }
    const title = await BookTitle.findById(copy.bookTitleId).session(session)
    const countField = { AVAILABLE: 'availableCopies', RESERVED: 'reservedCopies', DAMAGED: 'damagedCopies', LOST: 'lostCopies', UNDER_REPAIR: 'underRepairCopies' }[copy.status]
    if (title) {
      title.totalCopies = Math.max(0, title.totalCopies - 1)
      if (countField) title[countField] = Math.max(0, title[countField] - 1)
      await title.save({ session })
    }
    copy.isActive = false
    copy.deletedAt = new Date()
    await copy.save({ session })
    await recordAudit({ action: 'BOOK_COPY_ARCHIVED', entityType: 'BookCopy', entityId: copy._id, user, req, session, description: `Archived physical copy ${copy.copyId}.` })
    return copy
  })
}

export async function findCopyByRfid(rfid) {
  const copy = await BookCopy.findOne({ rfidUid: normalizeRfid(rfid), isActive: true })
    .populate('bookTitleId')
    .populate('currentHolderId', 'studentId registerNumber name department year section')
    .populate('currentCirculationId')
  if (!copy) throw ApiError.notFound('No registered book copy matches this RFID.')
  const reservation = await Reservation.findOne({
    preferredCopyId: copy._id,
    status: 'READY_FOR_PICKUP',
  }).populate('studentId', 'studentId registerNumber name')
    || await Reservation.findOne({
      bookTitleId: copy.bookTitleId,
      status: 'PENDING',
    }).sort({ queuePosition: 1 }).populate('studentId', 'studentId registerNumber name')
  return { ...copy.toObject(), reservation }
}

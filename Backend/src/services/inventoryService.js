import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import Circulation from '../models/Circulation.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import mongoose from 'mongoose'

export async function inventorySummary() {
  const [counts, totalTitles, totalStudents] = await Promise.all([
    BookCopy.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    BookTitle.countDocuments({ isActive: true }),
    import('../models/Student.js').then(({ default: Student }) => Student.countDocuments({ isActive: true })),
  ])
  const byStatus = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]))
  return {
    totalTitles,
    totalCopies: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    availableCopies: byStatus.AVAILABLE || 0,
    issuedCopies: byStatus.ISSUED || 0,
    reservedCopies: byStatus.RESERVED || 0,
    damagedCopies: byStatus.DAMAGED || 0,
    lostCopies: byStatus.LOST || 0,
    underRepairCopies: byStatus.UNDER_REPAIR || 0,
    totalStudents,
  }
}

export async function listInventory(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = { isActive: true }
  if (query.status) filter.status = query.status.toUpperCase()
  if (query.location) filter.location = new RegExp(String(query.location).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  if (query.bookTitleId) filter.bookTitleId = query.bookTitleId
  const [data, total] = await Promise.all([
    BookCopy.find(filter).populate('bookTitleId').populate('currentHolderId', 'studentId registerNumber name department').sort({ copyId: 1 }).skip(skip).limit(limit),
    BookCopy.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function getInventoryTitle(bookTitleId) {
  const title = await BookTitle.findById(bookTitleId)
  if (!title) throw ApiError.notFound('Book title not found.')
  return {
    title,
    copies: await BookCopy.find({ bookTitleId, isActive: true }).populate('currentHolderId', 'studentId registerNumber name'),
  }
}

export async function getInventoryCopy(copyId) {
  const copy = await BookCopy.findOne(mongoose.isValidObjectId(copyId)
    ? { $or: [{ _id: copyId }, { copyId }] }
    : { copyId }).populate('bookTitleId').populate('currentHolderId', 'studentId registerNumber name')
  if (!copy) throw ApiError.notFound('Book copy not found.')
  return copy
}

export async function changeCopyStatus(copyId, status, condition, user, req) {
  return withTransaction(async (session) => {
    const copy = await BookCopy.findOne(mongoose.isValidObjectId(copyId)
      ? { $or: [{ _id: copyId }, { copyId }], isActive: true }
      : { copyId, isActive: true }).session(session)
    if (!copy) throw ApiError.notFound('Book copy not found.')
    if (['ISSUED', 'RESERVED'].includes(status?.toUpperCase())) {
      throw ApiError.badRequest('Issued and reserved statuses must be set through circulation or reservation workflows.')
    }
    if (copy.currentCirculationId && !['ISSUED', 'LOST', 'DAMAGED'].includes(status)) {
      throw ApiError.conflict('Cannot make an issued copy available without processing its circulation.')
    }
    const previous = copy.status
    if (status) copy.status = status.toUpperCase()
    if (condition) copy.condition = condition.toUpperCase()
    if (copy.status === 'LOST') copy.condition = 'LOST'
    if (copy.condition === 'DAMAGED' && copy.status === 'AVAILABLE') copy.status = 'DAMAGED'
    await copy.save({ session })
    const title = await BookTitle.findById(copy.bookTitleId).session(session)
    if (!title) throw ApiError.conflict('Book title is missing for this copy.')
    if (previous !== copy.status) {
      const countField = {
        AVAILABLE: 'availableCopies', ISSUED: 'issuedCopies', RESERVED: 'reservedCopies',
        DAMAGED: 'damagedCopies', LOST: 'lostCopies', UNDER_REPAIR: 'underRepairCopies',
      }
      if (countField[previous]) title[countField[previous]] = Math.max(0, title[countField[previous]] - 1)
      if (countField[copy.status]) title[countField[copy.status]] += 1
      await title.save({ session })
    }
    if (previous === 'ISSUED' && ['LOST', 'DAMAGED'].includes(copy.status) && copy.currentCirculationId) {
      await Circulation.updateOne({ _id: copy.currentCirculationId, status: { $in: ['ISSUED', 'OVERDUE'] } }, { status: copy.status }, { session })
    }
    await recordAudit({
      action: 'INVENTORY_COPY_UPDATED', entityType: 'BookCopy', entityId: copy._id,
      user, req, session, description: `Updated inventory for copy ${copy.copyId}.`,
      metadata: { previousStatus: previous, status: copy.status, condition: copy.condition },
    })
    return copy
  })
}

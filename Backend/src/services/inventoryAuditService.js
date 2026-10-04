import InventoryAudit from '../models/InventoryAudit.js'
import BookCopy from '../models/BookCopy.js'
import BookTitle from '../models/BookTitle.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { recordAudit } from './auditService.js'

export async function listInventoryAudits(query) {
  const { page, limit, skip } = getPagination(query)
  const [data, total] = await Promise.all([
    InventoryAudit.find(query.status ? { status: query.status } : {}).sort({ startedAt: -1 }).skip(skip).limit(limit),
    InventoryAudit.countDocuments(query.status ? { status: query.status } : {}),
  ])
  return { data, page, limit, total }
}

export async function startInventoryAudit(values, user, req) {
  const titleFilter = { isActive: true }
  if (values.department) {
    const titles = await BookTitle.find({ department: values.department, isActive: true }).select('_id')
    titleFilter.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  if (values.location) titleFilter.location = values.location
  const copies = await BookCopy.find(titleFilter).select('copyId')
  const audit = await InventoryAudit.create({
    auditId: `AUD-${Date.now().toString(36).toUpperCase()}`,
    startedBy: user._id,
    location: values.location,
    department: values.department,
    expectedCopyIds: copies.map((copy) => copy.copyId),
  })
  await recordAudit({ action: 'INVENTORY_AUDIT_STARTED', entityType: 'InventoryAudit', entityId: audit._id, user, req, description: `Started inventory audit ${audit.auditId}.` })
  return audit
}

export async function scanInventoryAudit(id, rfidUid, user, req) {
  const audit = await InventoryAudit.findOne({ $or: [{ _id: id }, { auditId: id }], status: 'IN_PROGRESS' })
  if (!audit) throw ApiError.notFound('In-progress inventory audit not found.')
  const copy = await BookCopy.findOne({ rfidUid: String(rfidUid).replace(/[^A-Z0-9]/gi, '').toUpperCase(), isActive: true }).populate('bookTitleId')
  if (!copy) throw ApiError.notFound('Scanned RFID is not registered to an active copy.')
  if (!audit.scannedCopyIds.includes(copy.copyId)) audit.scannedCopyIds.push(copy.copyId)
  if (!audit.expectedCopyIds.includes(copy.copyId)) audit.unexpectedCopyIds.push(copy.copyId)
  if (audit.location && copy.location !== audit.location) audit.misplacedCopyIds.push(copy.copyId)
  await audit.save()
  await recordAudit({ action: 'INVENTORY_AUDIT_SCANNED', entityType: 'InventoryAudit', entityId: audit._id, user, req, description: `Scanned ${copy.copyId} during inventory audit.` })
  return { audit, copy, expected: audit.expectedCopyIds.includes(copy.copyId), misplaced: audit.misplacedCopyIds.includes(copy.copyId) }
}

export async function completeInventoryAudit(id, user, req) {
  const audit = await InventoryAudit.findOne({ $or: [{ _id: id }, { auditId: id }], status: 'IN_PROGRESS' })
  if (!audit) throw ApiError.notFound('In-progress inventory audit not found.')
  const scanned = new Set(audit.scannedCopyIds)
  audit.missingCopyIds = audit.expectedCopyIds.filter((copyId) => !scanned.has(copyId))
  audit.status = 'COMPLETED'
  audit.completedBy = user._id
  audit.completedAt = new Date()
  await audit.save()
  await recordAudit({ action: 'INVENTORY_AUDIT_COMPLETED', entityType: 'InventoryAudit', entityId: audit._id, user, req, description: `Completed inventory audit ${audit.auditId}.` })
  return audit
}

import AuditLog from '../models/AuditLog.js'
import { getPagination } from '../utils/pagination.js'

export function recordAudit({ action, entityType, entityId, user, req, description, metadata, session }) {
  return AuditLog.create([{
    action,
    entityType,
    entityId,
    performedBy: user?._id,
    targetUserId: metadata?.targetUserId,
    description,
    metadata,
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  }], { session }).then(([record]) => record)
}

export async function listAuditLogs(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  if (query.user) filter.performedBy = query.user
  if (query.action) filter.action = query.action
  if (query.entity) filter.entityType = query.entity
  if (query.from || query.to) filter.createdAt = {}
  if (query.from) filter.createdAt.$gte = new Date(query.from)
  if (query.to) filter.createdAt.$lte = new Date(query.to)
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('performedBy', 'name email role'),
    AuditLog.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export function getAuditLog(id) {
  return AuditLog.findById(id).populate('performedBy', 'name email role')
}

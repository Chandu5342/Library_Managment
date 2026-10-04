import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import { listAuditLogs, getAuditLog } from '../services/auditService.js'
import ApiError from '../utils/ApiError.js'

export const list = asyncHandler(async (req, res) => {
  const result = await listAuditLogs(req.query)
  return sendPage(res, 'Audit logs retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => {
  const log = await getAuditLog(req.params.id)
  if (!log) throw ApiError.notFound('Audit log not found.')
  return sendSuccess(res, 'Audit log retrieved successfully.', log)
})

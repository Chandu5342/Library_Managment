import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as inventory from '../services/inventoryService.js'
import * as audits from '../services/inventoryAuditService.js'
import * as analytics from '../services/analyticsService.js'

export const summary = asyncHandler(async (req, res) => sendSuccess(res, 'Inventory summary retrieved successfully.', await analytics.dashboardSummary()))
export const list = asyncHandler(async (req, res) => {
  const result = await inventory.listInventory(req.query)
  return sendPage(res, 'Inventory retrieved successfully.', result.data, result)
})
export const title = asyncHandler(async (req, res) => sendSuccess(res, 'Title inventory retrieved successfully.', await inventory.getInventoryTitle(req.params.bookTitleId)))
export const copy = asyncHandler(async (req, res) => sendSuccess(res, 'Copy inventory retrieved successfully.', await inventory.getInventoryCopy(req.params.copyId)))
export const status = asyncHandler(async (req, res) => sendSuccess(res, 'Inventory copy status updated successfully.', await inventory.changeCopyStatus(req.params.copyId, req.body.status, undefined, req.user, req)))
export const condition = asyncHandler(async (req, res) => sendSuccess(res, 'Inventory copy condition updated successfully.', await inventory.changeCopyStatus(req.params.copyId, undefined, req.body.condition, req.user, req)))
export const auditsList = asyncHandler(async (req, res) => {
  const result = await audits.listInventoryAudits(req.query)
  return sendPage(res, 'Inventory audits retrieved successfully.', result.data, result)
})
export const auditStart = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Inventory audit started successfully.', data: await audits.startInventoryAudit(req.body, req.user, req), meta: {},
}))
export const auditScan = asyncHandler(async (req, res) => sendSuccess(res, 'RFID scanned successfully.', await audits.scanInventoryAudit(req.params.id, req.body.rfid, req.user, req)))
export const auditComplete = asyncHandler(async (req, res) => sendSuccess(res, 'Inventory audit completed successfully.', await audits.completeInventoryAudit(req.params.id, req.user, req)))

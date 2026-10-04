import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as copies from '../services/bookCopyService.js'
import * as inventory from '../services/inventoryService.js'
import { findCopyByRfid } from '../services/bookCopyService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await copies.listBookCopies(req.query)
  return sendPage(res, 'Book copies retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy retrieved successfully.', await copies.getBookCopy(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Book copy created successfully.', data: await copies.createBookCopy(req.body, req.user, req), meta: {},
}))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy updated successfully.', await copies.updateBookCopy(req.params.id, req.body, req.user, req)))
export const remove = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy archived successfully.', await copies.archiveBookCopy(req.params.id, req.user, req)))
export const byRfid = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy retrieved successfully.', await findCopyByRfid(req.params.rfid)))
export const status = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy status updated successfully.', await inventory.changeCopyStatus(req.params.id, req.body.status, undefined, req.user, req)))
export const condition = asyncHandler(async (req, res) => sendSuccess(res, 'Book copy condition updated successfully.', await inventory.changeCopyStatus(req.params.id, undefined, req.body.condition, req.user, req)))

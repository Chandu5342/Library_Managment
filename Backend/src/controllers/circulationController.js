import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as circulation from '../services/circulationService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation(req.query)
  return sendPage(res, 'Circulation records retrieved successfully.', result.data, result)
})
export const active = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation({ ...req.query, status: 'ISSUED' })
  return sendPage(res, 'Active loans retrieved successfully.', result.data, result)
})
export const history = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation({ ...req.query, status: 'RETURNED' })
  return sendPage(res, 'Circulation history retrieved successfully.', result.data, result)
})
export const overdue = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation({ ...req.query, overdue: 'true' })
  return sendPage(res, 'Overdue loans retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => {
  const record = await circulation.getCirculation(req.params.id, req.user)
  if (!record) return res.status(404).json({ success: false, message: 'Circulation record not found.', errors: [] })
  return sendSuccess(res, 'Circulation record retrieved successfully.', record)
})
export const validateIssue = asyncHandler(async (req, res) => sendSuccess(res, 'Issue eligibility verified.', await circulation.validateIssue(req.body)))
export const issue = asyncHandler(async (req, res) => sendSuccess(res, 'Book issued successfully.', await circulation.issueBook(req.body, req.user, req)))
export const returnCopy = asyncHandler(async (req, res) => sendSuccess(res, 'Book returned successfully.', await circulation.returnBook(req.body, req.user, req)))
export const renew = asyncHandler(async (req, res) => sendSuccess(res, 'Book renewed successfully.', await circulation.renewBook(req.params.id, req.user, req)))
export const byStudent = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation({ ...req.query, studentId: req.params.studentId })
  return sendPage(res, 'Student circulation retrieved successfully.', result.data, result)
})
export const byCopy = asyncHandler(async (req, res) => {
  const result = await circulation.listCirculation({ ...req.query, bookCopyId: req.params.bookCopyId })
  return sendPage(res, 'Book circulation retrieved successfully.', result.data, result)
})

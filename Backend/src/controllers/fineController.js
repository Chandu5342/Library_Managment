import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as fines from '../services/fineService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await fines.listFines(req.query)
  return sendPage(res, 'Fines retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => {
  const fine = await fines.getFineForUser(req.params.id, req.user)
  return sendSuccess(res, 'Fine retrieved successfully.', fine)
})
export const byStudent = asyncHandler(async (req, res) => {
  const result = await fines.listFines({ ...req.query, studentId: req.params.studentId })
  return sendPage(res, 'Student fines retrieved successfully.', result.data, result)
})
export const pay = asyncHandler(async (req, res) => sendSuccess(res, 'Fine payment recorded successfully.', await fines.payFine(req.params.id, Number(req.body.amount), req.user, req, req.body)))
export const payOwn = asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Fine payment recorded successfully.', await fines.payFine(req.params.id, Number(req.body.amount), req.user, req, req.body))
})
export const waive = asyncHandler(async (req, res) => sendSuccess(res, 'Fine waived successfully.', await fines.waiveFine(req.params.id, req.body.reason, req.user, req)))
export const reversePayment = asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Fine payment reversed successfully.', await fines.reverseFinePayment(req.params.id, req.body.paymentId, req.body.reason, req.user, req))
})

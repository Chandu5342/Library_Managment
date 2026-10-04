import asyncHandler from '../utils/asyncHandler.js'
import { sendSuccess, sendPage } from '../utils/responseFormatter.js'
import { generateUniqueRfid, findByRfid, registerRfid, validateRfidValue, getRfidUsage } from '../services/rfidService.js'
import { logLookup, listRfidDevices, listRfidLogs } from '../services/rfidLogService.js'
import { findCopyByRfid } from '../services/bookCopyService.js'
import { findStudentByRfid } from '../services/studentService.js'
import { STAFF_ROLES } from '../config/constants.js'
import ApiError from '../utils/ApiError.js'

function assertStudentRfidAccess(student, user) {
  if (!STAFF_ROLES.includes(user.role) && String(student.userId) !== String(user._id)) {
    throw ApiError.forbidden('You can only view RFID details for your own student account.')
  }
}

export const book = asyncHandler(async (req, res) => {
  const copy = await findCopyByRfid(req.params.rfid)
  await logLookup(req.params.rfid, 'BOOK_COPY', req.user)
  return sendSuccess(res, 'Book RFID retrieved successfully.', copy)
})
export const student = asyncHandler(async (req, res) => {
  const value = await findStudentByRfid(req.params.rfid)
  assertStudentRfidAccess(value, req.user)
  await logLookup(req.params.rfid, 'STUDENT', req.user)
  return sendSuccess(res, 'Student RFID retrieved successfully.', value)
})
export const any = asyncHandler(async (req, res) => {
  const value = await findByRfid(req.params.rfid)
  if (value.type === 'STUDENT') assertStudentRfidAccess(value.student, req.user)
  await logLookup(req.params.rfid, value.type, req.user)
  return sendSuccess(res, 'RFID lookup completed successfully.', value)
})
export const generate = asyncHandler(async (_req, res) => sendSuccess(res, 'RFID generated successfully.', { rfidUid: await generateUniqueRfid() }))
export const validate = asyncHandler(async (req, res) => {
  return sendSuccess(res, 'RFID validation completed successfully.', await validateRfidValue(req.body.rfid))
})
export const register = asyncHandler(async (req, res) => sendSuccess(res, 'RFID registered successfully.', await registerRfid(req.body, req.user, req)))
export const logs = asyncHandler(async (req, res) => {
  const result = await listRfidLogs(req.query)
  return sendPage(res, 'RFID logs retrieved successfully.', result.data, result)
})
export const devices = asyncHandler(async (_req, res) => {
  const [devices, usage] = await Promise.all([listRfidDevices(), getRfidUsage()])
  return sendSuccess(res, 'RFID devices retrieved successfully.', { devices, usage })
})

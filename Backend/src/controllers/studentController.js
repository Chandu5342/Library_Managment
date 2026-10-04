import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as students from '../services/studentService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await students.listStudents(req.query)
  return sendPage(res, 'Students retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Student retrieved successfully.', await students.getStudent(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Student created successfully.', data: await students.createStudent(req.body, req.user, req), meta: {},
}))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Student updated successfully.', await students.updateStudent(req.params.id, req.body, req.user, req)))
export const remove = asyncHandler(async (req, res) => sendSuccess(res, 'Student deactivated successfully.', await students.archiveStudent(req.params.id, req.user, req)))
export const byRfid = asyncHandler(async (req, res) => sendSuccess(res, 'Student retrieved successfully.', await students.findStudentByRfid(req.params.rfid)))
export const history = asyncHandler(async (req, res) => {
  const result = await students.studentHistory(req.params.id, req.query)
  return sendPage(res, 'Student history retrieved successfully.', result.data, result)
})
export const currentBooks = asyncHandler(async (req, res) => sendSuccess(res, 'Current books retrieved successfully.', await students.currentBooks(req.params.id)))
export const fines = asyncHandler(async (req, res) => {
  const result = await students.studentFines(req.params.id, req.query)
  return sendPage(res, 'Student fines retrieved successfully.', result.data, result)
})
export const reservations = asyncHandler(async (req, res) => {
  const result = await students.studentReservations(req.params.id, req.query)
  return sendPage(res, 'Student reservations retrieved successfully.', result.data, result)
})
export const me = asyncHandler(async (req, res) => sendSuccess(res, 'Student profile retrieved successfully.', await students.getCurrentStudent(req.user._id)))

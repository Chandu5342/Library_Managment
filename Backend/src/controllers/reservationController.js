import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as reservations from '../services/reservationService.js'
import { issueBook } from '../services/circulationService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await reservations.listReservations(req.query)
  return sendPage(res, 'Reservations retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation retrieved successfully.', await reservations.getReservation(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Reservation created successfully.', data: await reservations.createReservation(req.body, req.user, req), meta: {},
}))
export const cancel = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation cancelled successfully.', await reservations.cancelReservation(req.params.id, req.user, req)))
export const approve = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation approved and ready for pickup.', await reservations.approveReservation(req.params.id, req.user, req)))
export const reject = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation rejected successfully.', await reservations.rejectReservation(req.params.id, req.body.reason, req.user, req)))
export const fulfill = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation fulfilled and book issued successfully.', await reservations.fulfillReservation(req.params.id, req.user, req, issueBook)))
export const expire = asyncHandler(async (req, res) => sendSuccess(res, 'Reservation expired successfully.', await reservations.expireReservation(req.params.id, req.user, req)))
export const byBook = asyncHandler(async (req, res) => {
  const result = await reservations.reservationsForBook(req.params.bookTitleId, req.query)
  return sendPage(res, 'Book reservations retrieved successfully.', result.data, result)
})
export const byStudent = asyncHandler(async (req, res) => {
  const result = await reservations.reservationsForStudent(req.params.studentId, req.query)
  return sendPage(res, 'Student reservations retrieved successfully.', result.data, result)
})

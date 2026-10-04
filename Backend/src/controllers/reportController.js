import asyncHandler from '../utils/asyncHandler.js'
import { sendPage } from '../utils/responseFormatter.js'
import * as reports from '../services/reportService.js'

const handler = (message, getData) => asyncHandler(async (req, res) => {
  const result = await getData(req.query)
  return sendPage(res, message, result.data, result)
})

export const books = handler('Book report retrieved successfully.', reports.reportBooks)
export const students = handler('Student report retrieved successfully.', reports.reportStudents)
export const circulation = handler('Circulation report retrieved successfully.', reports.reportCirculation)
export const overdue = handler('Overdue report retrieved successfully.', reports.reportOverdue)
export const fines = handler('Fine report retrieved successfully.', reports.reportFines)
export const reservations = handler('Reservation report retrieved successfully.', reports.reportReservations)
export const inventory = handler('Inventory report retrieved successfully.', reports.reportInventory)
export const acquisitions = handler('Acquisition report retrieved successfully.', reports.reportAcquisitions)

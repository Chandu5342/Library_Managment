import asyncHandler from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responseFormatter.js'
import * as analytics from '../services/analyticsService.js'

export const overview = asyncHandler(async (_req, res) => sendSuccess(res, 'Analytics overview retrieved successfully.', await analytics.analyticsOverview()))
export const mostBorrowedBooks = asyncHandler(async (req, res) => sendSuccess(res, 'Most borrowed books retrieved successfully.', await analytics.mostBorrowedBooks(req.query)))
export const mostBorrowedCategories = asyncHandler(async (req, res) => sendSuccess(res, 'Most borrowed categories retrieved successfully.', await analytics.mostBorrowedCategories(req.query)))
export const mostActiveStudents = asyncHandler(async (req, res) => sendSuccess(res, 'Most active students retrieved successfully.', await analytics.mostActiveStudents(req.query)))
export const departmentUsage = asyncHandler(async (_req, res) => sendSuccess(res, 'Department usage retrieved successfully.', await analytics.departmentUsage()))
export const circulationTrends = asyncHandler(async (req, res) => sendSuccess(res, 'Circulation trends retrieved successfully.', await analytics.circulationTrends(req.query)))
export const overdueTrends = asyncHandler(async (req, res) => sendSuccess(res, 'Overdue trends retrieved successfully.', await analytics.overdueTrends(req.query)))
export const reservationDemand = asyncHandler(async (_req, res) => sendSuccess(res, 'Reservation demand retrieved successfully.', await analytics.reservationDemand()))

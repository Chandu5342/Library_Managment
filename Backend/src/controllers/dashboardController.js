import asyncHandler from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responseFormatter.js'
import { dashboardSummary } from '../services/analyticsService.js'

export const summary = asyncHandler(async (_req, res) => sendSuccess(res, 'Dashboard summary retrieved successfully.', await dashboardSummary()))

import asyncHandler from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responseFormatter.js'
import * as auth from '../services/authService.js'

export const register = asyncHandler(async (req, res) => {
  res.status(201)
  return sendSuccess(res, 'Account created successfully.', await auth.register(req.body, req))
})
export const login = asyncHandler(async (req, res) => sendSuccess(res, 'Signed in successfully.', await auth.login(req.body, req)))
export const refresh = asyncHandler(async (req, res) => sendSuccess(res, 'Session refreshed successfully.', await auth.refresh(req.body.refreshToken)))
export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req.user._id)
  return sendSuccess(res, 'Signed out successfully.', {})
})
export const changePassword = asyncHandler(async (req, res) => sendSuccess(
  res,
  'Password changed successfully.',
  { user: await auth.changePassword(req.user._id, req.body) },
))
export const me = asyncHandler(async (req, res) => sendSuccess(res, 'Current user retrieved successfully.', auth.getCurrentUser(req.user)))

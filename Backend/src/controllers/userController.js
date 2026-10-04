import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import { listUsers, updateUser, updateProfile } from '../services/userService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await listUsers(req.query)
  return sendPage(res, 'Users retrieved successfully.', result.data, result)
})
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'User updated successfully.', await updateUser(req.params.id, req.body, req.user, req)))
export const profile = asyncHandler(async (req, res) => sendSuccess(res, 'Profile updated successfully.', await updateProfile(req.user._id, req.body)))

import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as notifications from '../services/notificationService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await notifications.listNotifications(req.user, req.query)
  return sendPage(res, 'Notifications retrieved successfully.', result.data, result)
})
export const markRead = asyncHandler(async (req, res) => sendSuccess(res, 'Notification marked as read.', await notifications.markNotificationRead(req.params.id, req.user)))
export const markAllRead = asyncHandler(async (req, res) => sendSuccess(res, 'Notifications marked as read.', await notifications.markAllNotificationsRead(req.user)))
export const remove = asyncHandler(async (req, res) => {
  await notifications.deleteNotification(req.params.id, req.user)
  return sendSuccess(res, 'Notification deleted successfully.', {})
})

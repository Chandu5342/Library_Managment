import Notification from '../models/Notification.js'
import User from '../models/User.js'
import { getPagination } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'

export async function createNotification({ userId, student, type, title, message, entityType, entityId, session }) {
  const resolvedUserId = userId || student?.userId
  if (!resolvedUserId) return null
  const [notification] = await Notification.create([{
    userId: resolvedUserId, type, title, message, entityType, entityId,
  }], { session })
  return notification
}

export async function listNotifications(user, query) {
  const { page, limit, skip } = getPagination(query)
  const filter = user.role === 'ADMIN' && query.userId ? { userId: query.userId } : { userId: user._id }
  if (query.isRead !== undefined) filter.isRead = query.isRead === 'true'
  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function markNotificationRead(id, user) {
  const record = await Notification.findOneAndUpdate(
    { _id: id, userId: user._id },
    { isRead: true, readAt: new Date() },
    { new: true },
  )
  if (!record) throw ApiError.notFound('Notification not found.')
  return record
}

export function markAllNotificationsRead(user) {
  return Notification.updateMany({ userId: user._id, isRead: false }, { isRead: true, readAt: new Date() })
}

export async function deleteNotification(id, user) {
  const record = await Notification.findOneAndDelete({ _id: id, userId: user._id })
  if (!record) throw ApiError.notFound('Notification not found.')
}

export async function createSystemNotification({ userId, type = 'SYSTEM', title, message, entityType, entityId }) {
  const user = await User.findById(userId).select('_id')
  if (!user) throw ApiError.notFound('Notification user not found.')
  return createNotification({ userId, type, title, message, entityType, entityId })
}

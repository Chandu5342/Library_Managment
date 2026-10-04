import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { recordAudit } from './auditService.js'
import Student from '../models/Student.js'

const userDto = (user) => ({
  ...user.toObject(),
  id: user.id,
  passwordHash: undefined,
  refreshTokenHash: undefined,
})

export async function listUsers(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  if (query.role) filter.role = query.role
  if (query.search) {
    const regex = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: regex }, { email: regex }]
  }
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  return { data: data.map(userDto), page, limit, total }
}

export async function updateUser(id, values, actor, req) {
  const user = await User.findById(id)
  if (!user) throw ApiError.notFound('User not found.')
  for (const key of ['name', 'phone', 'profileImage', 'isActive', 'role']) {
    if (values[key] !== undefined) user[key] = values[key]
  }
  if (values.email !== undefined) {
    const email = String(values.email).trim().toLowerCase()
    if (await User.exists({ email, _id: { $ne: user._id } })) throw ApiError.conflict('An account with this email already exists.')
    user.email = email
  }
  if (values.password) {
    user.passwordHash = await bcrypt.hash(values.password, 12)
    user.passwordChangeRequired = false
    user.passwordChangedAt = new Date()
  }
  await user.save()
  const memberTypeByRole = {
    STUDENT: 'Student',
    FACULTY: 'Faculty',
    LIBRARIAN: 'Librarian',
    ASSISTANT_LIBRARIAN: 'Staff',
  }
  await Student.updateOne({ userId: user._id }, {
    $set: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      isActive: user.isActive,
      ...(memberTypeByRole[user.role] ? { memberType: memberTypeByRole[user.role] } : {}),
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      membershipStatus: user.isActive ? 'ACTIVE' : 'INACTIVE',
    },
  })
  await recordAudit({ action: 'USER_UPDATED', entityType: 'User', entityId: user._id, user: actor, req, description: `Updated user ${user.email}.` })
  return userDto(user)
}

export async function updateProfile(id, values) {
  const user = await User.findById(id)
  if (!user) throw ApiError.notFound('User not found.')
  for (const key of ['name', 'phone', 'profileImage']) if (values[key] !== undefined) user[key] = values[key]
  if (values.email !== undefined) {
    const email = String(values.email).trim().toLowerCase()
    if (await User.exists({ email, _id: { $ne: user._id } })) throw ApiError.conflict('An account with this email already exists.')
    user.email = email
  }
  await user.save()
  await Student.updateOne({ userId: user._id }, {
    $set: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
    },
  })
  return userDto(user)
}

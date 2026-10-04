import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Student from '../models/Student.js'
import ApiError from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js'
import { recordAudit } from './auditService.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const publicUser = (user) => ({
  id: user.id, _id: user.id, name: user.name, email: user.email, role: user.role,
  phone: user.phone, profileImage: user.profileImage, institution: user.institution, isActive: user.isActive,
  passwordChangeRequired: Boolean(user.passwordChangeRequired),
})

async function issueSession(user, req, isNew = false) {
  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)
  user.refreshTokenHash = hashToken(refreshToken)
  user.lastLoginAt = new Date()
  await user.save()
  if (!isNew) {
    await recordAudit({
      action: 'LOGIN', entityType: 'User', entityId: user._id, user, req,
      description: `${user.email} signed in.`,
    })
  }
  return { user: publicUser(user), token: accessToken, accessToken, refreshToken, passwordChangeRequired: Boolean(user.passwordChangeRequired) }
}

export async function register(values, req) {
  const email = values.email.toLowerCase()
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists.')
  const linkedStudent = values.registerNumber
    ? await Student.findOne({ registerNumber: values.registerNumber.toUpperCase() })
    : null
  if (values.registerNumber && !linkedStudent) throw ApiError.badRequest('A student record with this register number was not found.')
  if (linkedStudent?.userId) throw ApiError.conflict('The student record is already linked to an account.')
  const user = await User.create({
    name: values.name,
    email,
    passwordHash: await bcrypt.hash(values.password, 12),
    role: 'STUDENT',
    phone: values.phone,
    passwordChangeRequired: false,
    passwordChangedAt: new Date(),
  })
  if (linkedStudent) {
    linkedStudent.userId = user._id
    await linkedStudent.save()
  }
  return issueSession(user, req, true)
}

export async function login({ email, password }, req) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokenHash')
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password.')
  }
  return issueSession(user, req)
}

export async function refresh(refreshToken) {
  let payload
  try {
    payload = jwt.verify(refreshToken, env.jwtSecret)
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token.')
  }
  if (payload.tokenType !== 'refresh') throw ApiError.unauthorized('Invalid refresh token.')
  const user = await User.findOne({ _id: payload.userId, isActive: true }).select('+refreshTokenHash')
  if (!user?.refreshTokenHash || hashToken(refreshToken) !== user.refreshTokenHash) {
    throw ApiError.unauthorized('Refresh session is no longer valid.')
  }
  const nextRefreshToken = generateRefreshToken(user)
  user.refreshTokenHash = hashToken(nextRefreshToken)
  await user.save()
  const accessToken = generateAccessToken(user)
  return {
    user: publicUser(user),
    token: accessToken,
    accessToken,
    refreshToken: nextRefreshToken,
  }
}

export async function logout(userId) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } })
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +refreshTokenHash')
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.unauthorized('Current password is incorrect.')
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw ApiError.badRequest('Choose a password different from your current password.')
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.passwordChangeRequired = false
  user.passwordChangedAt = new Date()
  await user.save()
  await Student.updateOne({ userId: user._id }, { $set: { name: user.name, email: user.email, phone: user.phone } })
  return publicUser(user)
}

export function getCurrentUser(user) {
  return publicUser(user)
}

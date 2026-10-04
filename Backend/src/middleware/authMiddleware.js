import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { env } from '../config/env.js'

export async function requireAuth(req, _res, next) {
  try {
    const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw ApiError.unauthorized()
    const payload = jwt.verify(token, env.jwtSecret)
    if (payload.tokenType !== 'access' || !payload.userId) throw ApiError.unauthorized('Invalid access token.')
    const user = await User.findOne({ _id: payload.userId, isActive: true }).select('-passwordHash -refreshTokenHash')
    if (!user) throw ApiError.unauthorized('Account is unavailable.')
    const allowedDuringPasswordChange = new Set([
      '/api/v1/auth/me',
      '/api/v1/auth/logout',
      '/api/v1/auth/change-password',
    ])
    if (user.passwordChangeRequired && !allowedDuringPasswordChange.has(req.originalUrl.split('?')[0])) {
      throw ApiError.forbidden('Change your temporary password before using the library system.')
    }
    req.user = user
    next()
  } catch (error) {
    if (error instanceof ApiError) return next(error)
    return next(ApiError.unauthorized('Invalid or expired access token.'))
  }
}

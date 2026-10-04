import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'

export function generateAccessToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, tokenType: 'access' }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  })
}

export function generateRefreshToken(user) {
  return jwt.sign({ userId: user.id, tokenType: 'refresh' }, env.jwtSecret, {
    subject: user.id,
    jwtid: randomUUID(),
    expiresIn: env.jwtRefreshExpiresIn,
  })
}

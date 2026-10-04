import { validationResult } from 'express-validator'
import ApiError from './ApiError.js'

export function validateRequest(req, _res, next) {
  const result = validationResult(req)
  if (!result.isEmpty()) {
    return next(ApiError.badRequest('Request validation failed.', result.array()))
  }
  return next()
}

import { body, param, query } from 'express-validator'
import { validateRfid } from '../services/rfidService.js'

export const idParam = (key = 'id') => param(key).isMongoId().withMessage(`${key} must be a valid ID.`)
export const rfidParam = (key = 'rfid') => param(key).trim().notEmpty().custom(validateRfid).withMessage('RFID format is invalid.')
export const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]
export const rfidBody = (key = 'rfid') => body(key).trim().notEmpty().custom(validateRfid).withMessage('RFID format is invalid.')
export const mongoIdBody = (key) => body(key).isMongoId().withMessage(`${key} must be a valid ID.`)
export const dateQueryValidators = [
  query('from').optional().isISO8601().toDate(),
  query('to').optional().isISO8601().toDate(),
]

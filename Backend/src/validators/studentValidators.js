import { body } from 'express-validator'
import { validateRfid } from '../services/rfidService.js'

export const studentCreateValidators = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('registerNumber').optional().trim().isLength({ min: 4, max: 32 }),
  body('registrationNumber').optional().trim().isLength({ min: 4, max: 32 }),
  body('studentId').optional().trim().isLength({ min: 2, max: 32 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('rfidUid').optional({ checkFalsy: true }).trim().custom(validateRfid),
  body('rfidCardId').optional({ checkFalsy: true }).trim().custom(validateRfid),
  body('memberType').optional().isIn(['Student', 'Faculty', 'Librarian', 'Staff']),
  body('year').optional().trim().isLength({ max: 30 }),
  body('section').optional().trim().isLength({ max: 20 }),
]
export const studentUpdateValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('rfidUid').optional().trim().custom(validateRfid),
  body('rfidCardId').optional().trim().custom(validateRfid),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'Active', 'Inactive', 'Blocked']),
  body('maximumBooksAllowed').optional().isInt({ min: 0 }).toInt(),
]

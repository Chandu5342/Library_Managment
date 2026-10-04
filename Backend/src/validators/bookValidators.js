import { body } from 'express-validator'
import { validateRfid } from '../services/rfidService.js'

export const bookCreateValidators = [
  body('title').trim().isLength({ min: 1, max: 300 }),
  body('authors').optional(),
  body('author').optional().trim(),
  body('publicationYear').optional({ checkFalsy: true }).isInt({ min: 1400, max: 2200 }).toInt(),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('quantity').optional().isInt({ min: 1, max: 1000 }).toInt(),
  body('rfidUid').optional().trim().custom(validateRfid),
  body('rfidId').optional().trim().custom(validateRfid),
]
export const bookUpdateValidators = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('publicationYear').optional().isInt({ min: 1400, max: 2200 }).toInt(),
  body('rfidUid').optional().trim().custom(validateRfid),
  body('rfidId').optional().trim().custom(validateRfid),
]
export const copyCreateValidators = [
  body('bookTitleId').isMongoId(),
  body('rfidUid').optional().trim().custom(validateRfid),
]

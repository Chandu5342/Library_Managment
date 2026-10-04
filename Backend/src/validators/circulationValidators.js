import { body } from 'express-validator'
import { validateRfid } from '../services/rfidService.js'

export const issueValidators = [
  body('studentId').isMongoId(),
  body('bookCopyId').notEmpty().withMessage('bookCopyId is required.'),
  body('bookRfid').trim().notEmpty().custom(validateRfid),
  body('reservationId').optional().isMongoId(),
]
export const returnValidators = [
  body('studentId').isMongoId(),
  body('bookRfid').trim().notEmpty().custom(validateRfid),
  body('conditionAtReturn').optional().isIn([
    'GOOD', 'FAIR', 'DAMAGED', 'LOST', 'UNDER_REPAIR',
    'Good', 'Fair', 'Damaged', 'Lost', 'Under Repair', 'UNDER REPAIR',
  ]),
]

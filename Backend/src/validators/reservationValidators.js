import { body } from 'express-validator'

export const reservationCreateValidators = [
  body('studentId').optional().isMongoId(),
  body('bookTitleId').isMongoId(),
]

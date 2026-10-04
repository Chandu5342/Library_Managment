import { body } from 'express-validator'

export const paymentValidators = [body('amount').isFloat({ gt: 0 }).toFloat()]
export const waiverValidators = [body('reason').trim().isLength({ min: 3, max: 500 })]
export const reversalValidators = [
  body('paymentId').isMongoId(),
  body('reason').trim().isLength({ min: 3, max: 500 }),
]

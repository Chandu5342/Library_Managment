import { body } from 'express-validator'

export const acquisitionValidators = [
  body('supplierId').optional().isMongoId(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.title').optional().trim().notEmpty(),
  body('items.*.quantityOrdered').optional().isInt({ min: 1 }).toInt(),
  body('items.*.quantity').optional().isInt({ min: 1 }).toInt(),
  body('items.*.unitCost').optional().isFloat({ min: 0 }).toFloat(),
]
export const receiveValidators = [body('items').optional().isArray({ min: 1 }), body('items.*.quantity').optional().isInt({ min: 1 }).toInt()]

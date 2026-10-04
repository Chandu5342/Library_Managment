import { body } from 'express-validator'

export const registerValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('registerNumber').optional().trim().isLength({ min: 4, max: 32 }),
]
export const loginValidators = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
]
export const refreshValidators = [body('refreshToken').isString().notEmpty()]
export const changePasswordValidators = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8, max: 128 }),
]

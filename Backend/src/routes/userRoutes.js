import { Router } from 'express'
import * as controller from '../controllers/userController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { paginationValidators, idParam } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { body } from 'express-validator'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole('ADMIN'), paginationValidators, validateRequest, controller.list)
router.patch(
  '/me/profile',
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('profileImage').optional().isString().isLength({ max: 2048 }),
  validateRequest,
  controller.profile,
)
router.patch(
  '/:id',
  requireRole('ADMIN'),
  idParam(),
  body('role').optional().isIn(STAFF_ROLES.concat(['FACULTY', 'STUDENT'])),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('password').optional().isLength({ min: 8, max: 128 }),
  validateRequest,
  controller.update,
)
export default router

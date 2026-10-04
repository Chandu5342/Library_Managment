import { Router } from 'express'
import { body } from 'express-validator'
import * as controller from '../controllers/supplierController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
router.get('/', paginationValidators, validateRequest, controller.list)
router.get('/:id', idParam(), validateRequest, controller.get)
router.post('/', body('supplierName').trim().notEmpty(), body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(), validateRequest, controller.create)
router.put('/:id', idParam(), body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(), validateRequest, controller.update)
router.delete('/:id', requireRole('ADMIN', 'LIBRARIAN'), idParam(), validateRequest, controller.remove)
export default router

import { Router } from 'express'
import * as controller from '../controllers/auditController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { idParam, paginationValidators, dateQueryValidators } from '../validators/commonValidators.js'
import { STAFF_ROLES } from '../config/constants.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
router.get('/', paginationValidators, ...dateQueryValidators, validateRequest, controller.list)
router.get('/:id', idParam(), validateRequest, controller.get)
export default router

import { Router } from 'express'
import * as controller from '../controllers/acquisitionController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { acquisitionValidators, receiveValidators } from '../validators/acquisitionValidators.js'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
router.get('/', paginationValidators, validateRequest, controller.list)
router.get('/:id', idParam(), validateRequest, controller.get)
router.post('/', acquisitionValidators, validateRequest, controller.create)
router.put('/:id', idParam(), acquisitionValidators, validateRequest, controller.update)
router.delete('/:id', idParam(), validateRequest, controller.remove)
router.post('/:id/receive', idParam(), receiveValidators, validateRequest, controller.receive)
export default router

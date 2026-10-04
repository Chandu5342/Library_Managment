import { Router } from 'express'
import * as controller from '../controllers/notificationController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth)
router.get('/', paginationValidators, validateRequest, controller.list)
router.patch('/read-all', controller.markAllRead)
router.patch('/:id/read', idParam(), validateRequest, controller.markRead)
router.delete('/:id', idParam(), validateRequest, controller.remove)
export default router

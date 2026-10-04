import { Router } from 'express'
import * as controller from '../controllers/bookController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { bookCreateValidators, bookUpdateValidators } from '../validators/bookValidators.js'

const router = Router()
router.use(requireAuth)
router.get('/', paginationValidators, validateRequest, controller.list)
router.get('/search', paginationValidators, validateRequest, controller.search)
router.get('/:id/copies', validateRequest, controller.copies)
router.get('/:id/availability', validateRequest, controller.availability)
router.get('/:id/holder', requireRole(...STAFF_ROLES), validateRequest, controller.holder)
router.get('/:id/history', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.history)
router.get('/:id', validateRequest, controller.get)
router.post('/', requireRole(...STAFF_ROLES), bookCreateValidators, validateRequest, controller.create)
router.put('/:id', requireRole(...STAFF_ROLES), idParam(), bookUpdateValidators, validateRequest, controller.update)
router.delete('/:id', requireRole('ADMIN', 'LIBRARIAN'), idParam(), validateRequest, controller.remove)
export default router

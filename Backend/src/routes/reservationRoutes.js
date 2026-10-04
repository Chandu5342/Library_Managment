import { Router } from 'express'
import * as controller from '../controllers/reservationController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { requireSelfOrStaff } from '../middleware/requireSelfOrRole.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { reservationCreateValidators } from '../validators/reservationValidators.js'
import { body } from 'express-validator'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.list)
router.get('/book/:bookTitleId', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.byBook)
router.get('/student/:studentId', paginationValidators, validateRequest, requireSelfOrStaff, controller.byStudent)
router.post('/', reservationCreateValidators, validateRequest, controller.create)
router.post('/:id/cancel', idParam(), validateRequest, controller.cancel)
router.post('/:id/approve', requireRole(...STAFF_ROLES), idParam(), validateRequest, controller.approve)
router.post('/:id/reject', requireRole(...STAFF_ROLES), idParam(), body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }), validateRequest, controller.reject)
router.post('/:id/fulfill', requireRole(...STAFF_ROLES), idParam(), validateRequest, controller.fulfill)
router.post('/:id/expire', requireRole('ADMIN', 'LIBRARIAN'), idParam(), validateRequest, controller.expire)
router.get('/:id', requireRole(...STAFF_ROLES), idParam(), validateRequest, controller.get)
export default router

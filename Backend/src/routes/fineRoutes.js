import { Router } from 'express'
import * as controller from '../controllers/fineController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { paymentValidators, waiverValidators, reversalValidators } from '../validators/fineValidators.js'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.list)
router.get('/student/:studentId', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.byStudent)
router.post('/:id/pay', idParam(), paymentValidators, validateRequest, (req, res, next) => req.user.role === 'STUDENT' ? controller.payOwn(req, res, next) : controller.pay(req, res, next))
router.post('/:id/reverse-payment', requireRole('ADMIN', 'LIBRARIAN'), idParam(), reversalValidators, validateRequest, controller.reversePayment)
router.post('/:id/waive', requireRole('ADMIN', 'LIBRARIAN'), idParam(), waiverValidators, validateRequest, controller.waive)
router.get('/:id', idParam(), validateRequest, controller.get)
export default router

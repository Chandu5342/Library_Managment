import { Router } from 'express'
import * as controller from '../controllers/reportController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { dateQueryValidators, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
const validators = [...paginationValidators, ...dateQueryValidators, validateRequest]
router.get('/books', ...validators, controller.books)
router.get('/students', ...validators, controller.students)
router.get('/circulation', ...validators, controller.circulation)
router.get('/overdue', ...validators, controller.overdue)
router.get('/fines', ...validators, controller.fines)
router.get('/reservations', ...validators, controller.reservations)
router.get('/inventory', ...validators, controller.inventory)
router.get('/acquisitions', ...validators, controller.acquisitions)
export default router

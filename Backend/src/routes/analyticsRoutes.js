import { Router } from 'express'
import * as controller from '../controllers/analyticsController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { validateRequest } from '../utils/validateRequest.js'
import { query } from 'express-validator'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
const days = [query('days').optional().isInt({ min: 1, max: 365 }).toInt(), validateRequest]
router.get('/overview', controller.overview)
router.get('/most-borrowed-books', controller.mostBorrowedBooks)
router.get('/most-borrowed-categories', controller.mostBorrowedCategories)
router.get('/most-active-students', controller.mostActiveStudents)
router.get('/department-usage', controller.departmentUsage)
router.get('/circulation-trends', ...days, controller.circulationTrends)
router.get('/overdue-trends', ...days, controller.overdueTrends)
router.get('/reservation-demand', controller.reservationDemand)
export default router

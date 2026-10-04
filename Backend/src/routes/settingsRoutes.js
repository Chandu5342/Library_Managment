import { Router } from 'express'
import { body } from 'express-validator'
import * as controller from '../controllers/settingsController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole('ADMIN', 'LIBRARIAN'), controller.get)
router.put('/', requireRole('ADMIN', 'LIBRARIAN'), [
  body('dailyFineAmount').optional().isFloat({ min: 0 }).toFloat(),
  body('finePerDay').optional().isFloat({ min: 0 }).toFloat(),
  body('defaultLoanPeriodDays').optional().isInt({ min: 1, max: 365 }).toInt(),
  body('loanPeriodDays').optional().isInt({ min: 1, max: 365 }).toInt(),
  body('maximumBooksPerStudent').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('borrowingLimit').optional().isInt({ min: 0, max: 100 }).toInt(),
], validateRequest, controller.update)
export default router

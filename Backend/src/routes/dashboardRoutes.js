import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import * as controller from '../controllers/dashboardController.js'

const router = Router()
router.get('/summary', requireAuth, requireRole(...STAFF_ROLES), controller.summary)
export default router

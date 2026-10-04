import { Router } from 'express'
import { body } from 'express-validator'
import * as controller from '../controllers/inventoryController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'

const router = Router()
router.use(requireAuth, requireRole(...STAFF_ROLES))
router.get('/summary', controller.summary)
router.get('/books', paginationValidators, validateRequest, controller.list)
router.get('/book/:bookTitleId', idParam('bookTitleId'), validateRequest, controller.title)
router.get('/copy/:copyId', validateRequest, controller.copy)
router.patch('/copy/:copyId/status', body('status').isIn(['AVAILABLE', 'ISSUED', 'RESERVED', 'DAMAGED', 'LOST', 'UNDER_REPAIR']), validateRequest, controller.status)
router.patch('/copy/:copyId/condition', body('condition').isIn(['GOOD', 'FAIR', 'DAMAGED', 'LOST']), validateRequest, controller.condition)
router.get('/audits', paginationValidators, validateRequest, controller.auditsList)
router.post('/audits', body('location').optional().trim(), validateRequest, controller.auditStart)
router.post('/audits/:id/scan', body('rfid').trim().notEmpty(), validateRequest, controller.auditScan)
router.post('/audits/:id/complete', validateRequest, controller.auditComplete)
export default router

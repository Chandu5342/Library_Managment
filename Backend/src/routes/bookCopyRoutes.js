import { Router } from 'express'
import * as controller from '../controllers/bookCopyController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, rfidParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { body } from 'express-validator'
import { copyCreateValidators } from '../validators/bookValidators.js'
import { validateRfid } from '../services/rfidService.js'

const router = Router()
router.use(requireAuth)
router.get('/', paginationValidators, validateRequest, controller.list)
router.get('/rfid/:rfid', rfidParam(), validateRequest, controller.byRfid)
router.get('/:id', validateRequest, controller.get)
router.post('/', requireRole(...STAFF_ROLES), copyCreateValidators, validateRequest, controller.create)
router.put('/:id', requireRole(...STAFF_ROLES), body('rfidUid').optional().trim().custom(validateRfid), validateRequest, controller.update)
router.patch('/:id/status', requireRole(...STAFF_ROLES), body('status').isIn(['AVAILABLE', 'ISSUED', 'RESERVED', 'DAMAGED', 'LOST', 'UNDER_REPAIR']), validateRequest, controller.status)
router.patch('/:id/condition', requireRole(...STAFF_ROLES), body('condition').isIn(['GOOD', 'FAIR', 'DAMAGED', 'LOST']), validateRequest, controller.condition)
router.delete('/:id', requireRole('ADMIN', 'LIBRARIAN'), idParam(), validateRequest, controller.remove)
export default router

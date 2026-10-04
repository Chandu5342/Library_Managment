import { Router } from 'express'
import * as controller from '../controllers/rfidController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { STAFF_ROLES } from '../config/constants.js'
import { rfidParam } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { body } from 'express-validator'

const router = Router()
router.use(requireAuth)
router.get('/book/:rfid', rfidParam(), validateRequest, controller.book)
router.get('/student/:rfid', rfidParam(), validateRequest, controller.student)
router.get('/logs', requireRole(...STAFF_ROLES), controller.logs)
router.get('/devices', requireRole(...STAFF_ROLES), controller.devices)
router.get('/:rfid', rfidParam(), validateRequest, controller.any)
router.post('/generate', requireRole(...STAFF_ROLES), controller.generate)
router.post('/validate', body('rfid').trim().notEmpty(), validateRequest, controller.validate)
router.post('/register', requireRole(...STAFF_ROLES), body('type').isIn(['BOOK_COPY', 'STUDENT']), body('id').isMongoId(), body('rfid').trim().notEmpty(), validateRequest, controller.register)
export default router

import { Router } from 'express'
import * as controller from '../controllers/studentController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { requireSelfOrStaff } from '../middleware/requireSelfOrRole.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, rfidParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { studentCreateValidators, studentUpdateValidators } from '../validators/studentValidators.js'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.list)
router.get('/search', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.list)
router.get('/rfid/:rfid', requireRole(...STAFF_ROLES), rfidParam(), validateRequest, controller.byRfid)
router.get('/me', requireRole('STUDENT', 'FACULTY'), controller.me)
router.get('/:id/history', idParam(), requireSelfOrStaff, paginationValidators, validateRequest, controller.history)
router.get('/:id/current-books', idParam(), requireSelfOrStaff, validateRequest, controller.currentBooks)
router.get('/:id/fines', idParam(), requireSelfOrStaff, paginationValidators, validateRequest, controller.fines)
router.get('/:id/reservations', idParam(), requireSelfOrStaff, paginationValidators, validateRequest, controller.reservations)
router.get('/:id', idParam(), requireSelfOrStaff, validateRequest, controller.get)
router.post('/', requireRole('ADMIN', 'LIBRARIAN', 'ASSISTANT_LIBRARIAN'), studentCreateValidators, validateRequest, controller.create)
router.put('/:id', requireRole('ADMIN', 'LIBRARIAN', 'ASSISTANT_LIBRARIAN'), idParam(), studentUpdateValidators, validateRequest, controller.update)
router.delete('/:id', requireRole('ADMIN', 'LIBRARIAN'), idParam(), validateRequest, controller.remove)
export default router

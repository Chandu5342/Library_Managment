import { Router } from 'express'
import * as controller from '../controllers/circulationController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'
import { requireSelfOrStaff } from '../middleware/requireSelfOrRole.js'
import { STAFF_ROLES } from '../config/constants.js'
import { idParam, paginationValidators } from '../validators/commonValidators.js'
import { validateRequest } from '../utils/validateRequest.js'
import { issueValidators, returnValidators } from '../validators/circulationValidators.js'

const router = Router()
router.use(requireAuth)
router.get('/', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.list)
router.get('/active', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.active)
router.get('/history', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.history)
router.get('/overdue', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.overdue)
router.get('/student/:studentId', paginationValidators, validateRequest, requireSelfOrStaff, controller.byStudent)
router.get('/book/:bookCopyId', requireRole(...STAFF_ROLES), paginationValidators, validateRequest, controller.byCopy)
router.post('/validate-issue', requireRole(...STAFF_ROLES), issueValidators, validateRequest, controller.validateIssue)
router.post('/issue', requireRole(...STAFF_ROLES), issueValidators, validateRequest, controller.issue)
router.post('/return', requireRole(...STAFF_ROLES), returnValidators, validateRequest, controller.returnCopy)
router.post('/:id/renew', idParam(), validateRequest, controller.renew)
router.get('/:id', idParam(), validateRequest, controller.get)
export default router

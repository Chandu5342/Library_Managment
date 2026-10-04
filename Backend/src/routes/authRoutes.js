import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { validateRequest } from '../utils/validateRequest.js'
import { registerValidators, loginValidators, refreshValidators, changePasswordValidators } from '../validators/authValidators.js'

const router = Router()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })

router.post('/register', authLimiter, registerValidators, validateRequest, controller.register)
router.post('/login', authLimiter, loginValidators, validateRequest, controller.login)
router.post('/refresh', authLimiter, refreshValidators, validateRequest, controller.refresh)
router.post('/logout', requireAuth, controller.logout)
router.put('/change-password', requireAuth, changePasswordValidators, validateRequest, controller.changePassword)
router.get('/me', requireAuth, controller.me)

export default router

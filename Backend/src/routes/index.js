import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import studentRoutes from './studentRoutes.js'
import bookRoutes from './bookRoutes.js'
import bookCopyRoutes from './bookCopyRoutes.js'
import circulationRoutes from './circulationRoutes.js'
import reservationRoutes from './reservationRoutes.js'
import fineRoutes from './fineRoutes.js'
import supplierRoutes from './supplierRoutes.js'
import acquisitionRoutes from './acquisitionRoutes.js'
import inventoryRoutes from './inventoryRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import reportRoutes from './reportRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import settingsRoutes from './settingsRoutes.js'
import auditRoutes from './auditRoutes.js'
import rfidRoutes from './rfidRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'

const router = Router()
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/students', studentRoutes)
router.use('/books', bookRoutes)
router.use('/book-copies', bookCopyRoutes)
router.use('/circulation', circulationRoutes)
router.use('/reservations', reservationRoutes)
router.use('/fines', fineRoutes)
router.use('/suppliers', supplierRoutes)
router.use('/acquisitions', acquisitionRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/notifications', notificationRoutes)
router.use('/reports', reportRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/settings', settingsRoutes)
router.use('/audit-logs', auditRoutes)
router.use('/rfid', rfidRoutes)
router.use('/dashboard', dashboardRoutes)

export default router

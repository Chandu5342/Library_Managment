import mongoose from 'mongoose'
import { RESERVATION_STATUSES } from '../config/constants.js'

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  bookTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookTitle', required: true, index: true },
  preferredCopyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy' },
  queuePosition: { type: Number, required: true, min: 1 },
  requestDate: { type: Date, default: Date.now },
  status: { type: String, enum: RESERVATION_STATUSES, default: 'PENDING', index: true },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  readyAt: Date,
  expiresAt: Date,
  fulfilledAt: Date,
  rejectedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, trim: true, maxlength: 500 },
  cancelledAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { timestamps: true })

reservationSchema.index({ studentId: 1, bookTitleId: 1, status: 1 })
reservationSchema.index({ bookTitleId: 1, status: 1, queuePosition: 1 })
export default mongoose.model('Reservation', reservationSchema)

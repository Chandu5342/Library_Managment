import mongoose from 'mongoose'
import { FINE_STATUSES } from '../config/constants.js'

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, default: 'CASH' },
  paymentReference: String,
  paidAt: { type: Date, default: Date.now },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reversedAt: Date,
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reversalReason: String,
})

const fineSchema = new mongoose.Schema({
  fineId: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  circulationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circulation', required: true, unique: true },
  bookTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookTitle', required: true },
  bookCopyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy', required: true },
  reason: { type: String, default: 'OVERDUE' },
  daysOverdue: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: FINE_STATUSES, default: 'PENDING', index: true },
  paymentHistory: { type: [paymentSchema], default: [] },
  paidAt: Date,
  waivedAt: Date,
  waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  waiverReason: String,
  notes: String,
}, { timestamps: true })

fineSchema.index({ studentId: 1, status: 1 })
export default mongoose.model('Fine', fineSchema)

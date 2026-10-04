import mongoose from 'mongoose'
import { CIRCULATION_STATUSES } from '../config/constants.js'

const circulationSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  bookTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookTitle', required: true, index: true },
  bookCopyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy', required: true, index: true },
  bookRfid: { type: String, required: true, uppercase: true, trim: true, index: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issueDate: { type: Date, required: true, default: Date.now, index: true },
  dueDate: { type: Date, required: true, index: true },
  returnDate: Date,
  status: { type: String, enum: CIRCULATION_STATUSES, default: 'ISSUED', index: true },
  renewalCount: { type: Number, default: 0, min: 0 },
  conditionAtIssue: String,
  conditionAtReturn: String,
  fineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' },
  notes: String,
}, { timestamps: true })

circulationSchema.index({ studentId: 1, status: 1, dueDate: 1 })
circulationSchema.index({ bookCopyId: 1, status: 1 })
export default mongoose.model('Circulation', circulationSchema)

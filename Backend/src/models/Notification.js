import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['BOOK_ISSUED', 'BOOK_RETURNED', 'BOOK_OVERDUE', 'RESERVATION_CREATED', 'RESERVATION_READY', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED', 'RESERVATION_EXPIRED', 'FINE_CREATED', 'FINE_PAID', 'SYSTEM'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  isRead: { type: Boolean, default: false, index: true },
  readAt: Date,
}, { timestamps: true })

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
export default mongoose.model('Notification', notificationSchema)

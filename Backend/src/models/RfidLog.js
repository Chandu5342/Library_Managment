import mongoose from 'mongoose'

const rfidLogSchema = new mongoose.Schema({
  rfidUid: { type: String, required: true, uppercase: true, index: true },
  entityType: { type: String, enum: ['BOOK_COPY', 'STUDENT', 'UNKNOWN'], required: true },
  entityId: mongoose.Schema.Types.ObjectId,
  event: { type: String, required: true },
  result: { type: String, default: 'SUCCESS' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: String,
}, { timestamps: true })

rfidLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
export default mongoose.model('RfidLog', rfidLogSchema)

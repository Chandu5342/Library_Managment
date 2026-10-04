import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String, required: true },
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
}, { timestamps: { createdAt: true, updatedAt: false } })

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
export default mongoose.model('AuditLog', auditLogSchema)

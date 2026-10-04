import mongoose from 'mongoose'

const rfidDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['ONLINE', 'OFFLINE', 'SIMULATION'], default: 'SIMULATION' },
  location: String,
  firmware: String,
  totalScans: { type: Number, default: 0 },
  lastHeartbeat: Date,
}, { timestamps: true })

export default mongoose.model('RfidDevice', rfidDeviceSchema)

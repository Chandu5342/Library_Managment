import mongoose from 'mongoose'

const librarySettingSchema = new mongoose.Schema({
  singletonKey: { type: String, default: 'library', unique: true },
  libraryName: { type: String, default: 'Vignan Institute of Information Technology Library' },
  branch: { type: String, default: 'Central Library' },
  dailyFineAmount: { type: Number, default: 5, min: 0 },
  defaultLoanPeriodDays: { type: Number, default: 14, min: 1 },
  maximumBooksPerStudent: { type: Number, default: 5, min: 0 },
  maximumReservationsPerStudent: { type: Number, default: 5, min: 0 },
  reservationPickupDays: { type: Number, default: 2, min: 1 },
  allowRenewals: { type: Boolean, default: true },
  maximumRenewals: { type: Number, default: 2, min: 0 },
  libraryWorkingHours: { type: String, default: '08:00-20:00' },
  memberTypeRules: { type: mongoose.Schema.Types.Mixed, default: {} },
  autoLookup: { type: Boolean, default: true },
  autoFocus: { type: Boolean, default: true },
  duplicateScanPrevention: { type: Boolean, default: true },
  simulationMode: { type: Boolean, default: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  currency: { type: String, default: 'INR' },
  academicYear: String,
  blockBorrowingWithUnpaidFines: { type: Boolean, default: true },
  blockingFineAmount: { type: Number, default: 500, min: 0 },
  blockBorrowingWithOverdueBooks: { type: Boolean, default: false },
  allowRenewalWithReservations: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('LibrarySetting', librarySettingSchema)

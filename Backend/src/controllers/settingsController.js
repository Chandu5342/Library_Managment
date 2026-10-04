import asyncHandler from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responseFormatter.js'
import { getSettings, updateSettings } from '../services/settingsService.js'
import { recordAudit } from '../services/auditService.js'

function settingsDto(settings) {
  const value = settings.toObject()
  return {
    ...value,
    loanPeriodDays: value.defaultLoanPeriodDays,
    finePerDay: value.dailyFineAmount,
    borrowingLimit: value.maximumBooksPerStudent,
    pickupWindowDays: value.reservationPickupDays,
    maximumActiveReservations: value.maximumReservationsPerStudent,
    workingHours: value.libraryWorkingHours,
  }
}

export const get = asyncHandler(async (_req, res) => sendSuccess(res, 'Settings retrieved successfully.', settingsDto(await getSettings())))
export const update = asyncHandler(async (req, res) => {
  const payload = { ...req.body }
  const aliases = {
    loanPeriodDays: 'defaultLoanPeriodDays',
    finePerDay: 'dailyFineAmount',
    borrowingLimit: 'maximumBooksPerStudent',
    pickupWindowDays: 'reservationPickupDays',
    maximumActiveReservations: 'maximumReservationsPerStudent',
    workingHours: 'libraryWorkingHours',
  }
  for (const [alias, field] of Object.entries(aliases)) {
    if (payload[alias] !== undefined && payload[field] === undefined) payload[field] = payload[alias]
    delete payload[alias]
  }
  const settings = await updateSettings(payload)
  await recordAudit({ action: 'SETTINGS_UPDATED', entityType: 'LibrarySetting', entityId: settings._id, user: req.user, req, description: 'Updated library settings.' })
  return sendSuccess(res, 'Settings updated successfully.', settingsDto(settings))
})

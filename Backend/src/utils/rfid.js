export function normalizeRfid(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

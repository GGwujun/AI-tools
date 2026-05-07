const DEVICE_ID_KEY = 'fund-assistant-device-id'

export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) {
    return existing
  }

  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  localStorage.setItem(DEVICE_ID_KEY, created)
  return created
}

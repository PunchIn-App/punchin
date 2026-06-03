const KEY = 'pi.deviceId'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'default'
  }
}

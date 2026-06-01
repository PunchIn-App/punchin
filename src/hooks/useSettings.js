import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export function useSettings() {
  const settings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
  }, [])

  const updateSetting = async (key, value) => {
    await db.settings.put({ key, value })
  }

  return { settings: settings || {}, updateSetting }
}

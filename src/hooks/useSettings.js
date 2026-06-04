import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db'

export function useSettings() {
  // Merge the live rows over DEFAULT_SETTINGS (issue #134) so consumers always
  // read a complete, typed settings object and can drop ad-hoc per-call
  // fallbacks. During the initial (undefined) load we also return the defaults
  // rather than {}, so a brief render never sees missing keys.
  const settings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), { ...DEFAULT_SETTINGS })
  }, [])

  const updateSetting = async (key, value) => {
    await db.settings.put({ key, value })
  }

  return { settings: settings || DEFAULT_SETTINGS, updateSetting }
}

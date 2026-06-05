import { Bell, Hourglass, AlarmClock, CalendarClock, CalendarCheck } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { notificationsSupported, requestNotificationPermission } from '../../utils/notifications'
import { Panel, SettingsRow, ReminderRow, WeekdayPicker, Toggle, WEEKDAYS, ALL_DAYS } from './components'
import LongRunningMinutesInput from './LongRunningMinutesInput'

const reminderInputClass = 'bg-appBg border border-appBorder text-appText rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

export default function RemindersPanel({ onBack, notifPerm, setNotifPerm }) {
  const { settings, updateSetting } = useSettings()

  const notifSupported = notificationsSupported()
  const remindersOn = !!settings.remindersEnabled && notifPerm === 'granted'

  // Turning reminders on requests notification permission first; we only flip
  // the setting if the user grants it, so an enabled toggle always means alerts
  // can actually be shown (issue #54).
  const handleRemindersToggle = async (on) => {
    if (!on) {
      await updateSetting('remindersEnabled', false)
      return
    }
    const perm = await requestNotificationPermission()
    setNotifPerm(perm)
    await updateSetting('remindersEnabled', perm === 'granted')
  }

  // Writing a reminder's chosen weekdays. Clearing the last day reads as "I
  // don't want this reminder" — so instead of saving an empty (never-fires) set,
  // switch the reminder off and restore all days for a clean re-enable later.
  const setReminderDays = (enabledKey, daysKey, days) => {
    if (days.length === 0) {
      updateSetting(enabledKey, false)
      updateSetting(daysKey, ALL_DAYS)
    } else {
      updateSetting(daysKey, days)
    }
  }

  return (
    <Panel title="Reminders" onBack={onBack}>
      <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
        {!notifSupported ? (
          <div className="px-4 py-4">
            <p className="text-sm text-appText font-medium">Reminders aren't available here</p>
            <p className="text-xs text-appTextMuted mt-0.5">
              This browser doesn't support notifications. On iPhone or iPad, add PunchIn to your
              Home Screen first, then reminders become available.
            </p>
          </div>
        ) : (
          <>
            <SettingsRow
              icon={Bell}
              title="Reminders"
              subtitle="Checked on your device while PunchIn is open, and caught up when you reopen it"
              right={
                <Toggle
                  ariaLabel="Enable reminders"
                  value={remindersOn}
                  onChange={handleRemindersToggle}
                />
              }
            />

            {notifPerm === 'denied' && (
              <div className="px-4 py-3 bg-red-500/5">
                <p className="text-xs text-red-400">
                  Notifications are blocked. Allow notifications for PunchIn in your browser or
                  device settings, then turn reminders on again.
                </p>
              </div>
            )}

            {remindersOn && (
              <>
                {/* Be honest about the delivery model (issue #112): these are
                    local notifications with no server, so a fully closed app
                    can't be woken to alert at an exact time. They fire while
                    PunchIn is open and catch up the next time it's opened. */}
                <div className="px-4 py-3 bg-appAccent/5">
                  <p className="text-xs text-appTextMuted">
                    PunchIn has no server, so reminders are checked on your device while the app is
                    open and catch up the next time you open it. A fully closed app — overnight, say —
                    can't be woken to alert you at an exact time, so keep PunchIn on your Home Screen
                    and open it daily for the most reliable nudges.
                  </p>
                </div>

                <ReminderRow
                  icon={Hourglass}
                  title="Long-running timer"
                  subtitle="If a timer runs longer than your chosen time"
                  enabled={settings.remindLongRunning !== false}
                  onToggle={v => updateSetting('remindLongRunning', v)}
                >
                  <div className="flex items-center gap-2 text-xs text-appTextMuted">
                    <span>Notify after</span>
                    <LongRunningMinutesInput
                      minutes={settings.remindLongRunningMinutes ?? 60}
                      onChange={v => updateSetting('remindLongRunningMinutes', v)}
                      onTurnOff={() => updateSetting('remindLongRunning', false)}
                    />
                  </div>
                </ReminderRow>

                <ReminderRow
                  icon={AlarmClock}
                  title="No timer running"
                  subtitle="If nothing is tracking by a time of day"
                  enabled={!!settings.remindIdle}
                  onToggle={v => updateSetting('remindIdle', v)}
                >
                  <label className="flex items-center gap-2 text-xs text-appTextMuted">
                    At
                    <input
                      type="time"
                      value={settings.remindIdleTime || '09:00'}
                      onChange={e => updateSetting('remindIdleTime', e.target.value)}
                      aria-label="No-timer reminder time"
                      className={reminderInputClass}
                    />
                  </label>
                  <WeekdayPicker
                    value={settings.remindIdleDays}
                    onChange={days => setReminderDays('remindIdle', 'remindIdleDays', days)}
                    label="Days for the no-timer reminder"
                  />
                </ReminderRow>

                <ReminderRow
                  icon={CalendarClock}
                  title="Timer still running"
                  subtitle="If a timer is still going at a time of day"
                  enabled={!!settings.remindStillRunning}
                  onToggle={v => updateSetting('remindStillRunning', v)}
                >
                  <label className="flex items-center gap-2 text-xs text-appTextMuted">
                    At
                    <input
                      type="time"
                      value={settings.remindStillRunningTime || '17:00'}
                      onChange={e => updateSetting('remindStillRunningTime', e.target.value)}
                      aria-label="Still-running reminder time"
                      className={reminderInputClass}
                    />
                  </label>
                  <WeekdayPicker
                    value={settings.remindStillRunningDays}
                    onChange={days => setReminderDays('remindStillRunning', 'remindStillRunningDays', days)}
                    label="Days for the still-running reminder"
                  />
                </ReminderRow>

                <ReminderRow
                  icon={CalendarCheck}
                  title="Daily timesheet"
                  subtitle="A nudge to review today's hours"
                  enabled={!!settings.remindTimesheetDaily}
                  onToggle={v => updateSetting('remindTimesheetDaily', v)}
                >
                  <label className="flex items-center gap-2 text-xs text-appTextMuted">
                    At
                    <input
                      type="time"
                      value={settings.remindTimesheetDailyTime || '17:00'}
                      onChange={e => updateSetting('remindTimesheetDailyTime', e.target.value)}
                      aria-label="Daily timesheet reminder time"
                      className={reminderInputClass}
                    />
                  </label>
                  <WeekdayPicker
                    value={settings.remindTimesheetDailyDays}
                    onChange={days => setReminderDays('remindTimesheetDaily', 'remindTimesheetDailyDays', days)}
                    label="Days for the daily timesheet reminder"
                  />
                </ReminderRow>

                <ReminderRow
                  icon={CalendarCheck}
                  title="Weekly timesheet"
                  subtitle="A weekly nudge to submit your hours"
                  enabled={!!settings.remindTimesheetWeekly}
                  onToggle={v => updateSetting('remindTimesheetWeekly', v)}
                >
                  <label className="flex items-center gap-2 text-xs text-appTextMuted">
                    On
                    <select
                      value={settings.remindTimesheetWeeklyDay ?? 5}
                      onChange={e => updateSetting('remindTimesheetWeeklyDay', Number(e.target.value))}
                      aria-label="Weekly timesheet reminder day"
                      className={reminderInputClass}
                    >
                      {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-appTextMuted">
                    at
                    <input
                      type="time"
                      value={settings.remindTimesheetWeeklyTime || '16:00'}
                      onChange={e => updateSetting('remindTimesheetWeeklyTime', e.target.value)}
                      aria-label="Weekly timesheet reminder time"
                      className={reminderInputClass}
                    />
                  </label>
                </ReminderRow>
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

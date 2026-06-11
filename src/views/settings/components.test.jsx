import { render, screen, fireEvent, within } from '@testing-library/react'
import { WeekdayPicker, PanelGroup, DangerZone, SettingsRow } from './components'

const DummyIcon = () => <svg data-testid="icon" />

describe('SettingsRow — info (ⓘ) disclosure', () => {
  it('renders an ⓘ button when `info` is provided, revealing the detail only on demand', () => {
    render(<SettingsRow icon={DummyIcon} title="Time format" subtitle="Clock times" info="The longer explanation" />)
    const info = screen.getByRole('button', { name: /about time format/i })
    expect(info).toBeInTheDocument()
    expect(screen.queryByText('The longer explanation')).not.toBeInTheDocument() // off-caption until tapped
    fireEvent.click(info)
    expect(screen.getByText('The longer explanation')).toBeInTheDocument()
  })

  it('renders no ⓘ button when `info` is omitted', () => {
    render(<SettingsRow icon={DummyIcon} title="Week starts Monday" subtitle="Off = Sunday" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('WeekdayPicker — display order vs stored value', () => {
  it('rotates the display to Monday-first but stores ABSOLUTE weekday indices', () => {
    const onChange = vi.fn()
    render(<WeekdayPicker value={[]} onChange={onChange} label="Days" weekStartsMonday />)
    const buttons = within(screen.getByRole('group', { name: 'Days' })).getAllByRole('button')

    // First displayed cell is Monday, last is Sunday...
    expect(buttons[0]).toHaveAccessibleName('Monday')
    expect(buttons[6]).toHaveAccessibleName('Sunday')

    // ...but the value stored is the absolute index (Mon=1, Sun=0), not the position.
    fireEvent.click(buttons[0])
    expect(onChange).toHaveBeenCalledWith([1])
    onChange.mockClear()
    fireEvent.click(buttons[6])
    expect(onChange).toHaveBeenCalledWith([0])
  })

  it('keeps Sunday-first order when weekStartsMonday is false', () => {
    render(<WeekdayPicker value={[]} onChange={vi.fn()} label="Days" weekStartsMonday={false} />)
    const buttons = within(screen.getByRole('group', { name: 'Days' })).getAllByRole('button')
    expect(buttons[0]).toHaveAccessibleName('Sunday')
  })
})

describe('PanelGroup — opt-in collapse', () => {
  it('hides children when defaultCollapsed and reveals them on click', () => {
    render(<PanelGroup title="Danger Zone" danger collapsible defaultCollapsed><p>boom</p></PanelGroup>)
    expect(screen.queryByText('boom')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i }))
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('renders children directly when not collapsible (default)', () => {
    render(<PanelGroup title="Backup"><p>always</p></PanelGroup>)
    expect(screen.getByText('always')).toBeInTheDocument()
  })
})

describe('DangerZone — collapsed card toggle', () => {
  it('is collapsed by default: shows the summary toggle, hides the destructive rows', () => {
    render(<DangerZone><p>destructive</p></DangerZone>)
    expect(screen.getByRole('button', { name: /danger zone/i })).toBeInTheDocument()
    expect(screen.getByText(/clear entries · factory reset · irreversible/i)).toBeInTheDocument()
    expect(screen.queryByText('destructive')).toBeNull()
  })

  it('reveals the rows on expand and hides them again on collapse', () => {
    render(<DangerZone><p>destructive</p></DangerZone>)
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i })) // expand
    expect(screen.getByText('destructive')).toBeInTheDocument()
    expect(screen.queryByText(/clear entries · factory reset/i)).toBeNull() // summary gone once open
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i })) // collapse
    expect(screen.queryByText('destructive')).toBeNull()
  })
})

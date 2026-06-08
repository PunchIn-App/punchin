import { render, screen, fireEvent, within } from '@testing-library/react'
import { WeekdayPicker, PanelGroup, DangerZone } from './components'

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

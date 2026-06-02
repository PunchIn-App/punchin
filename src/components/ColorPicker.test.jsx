import { render, screen, fireEvent } from '@testing-library/react'
import ColorPicker from './ColorPicker'

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }) => (
    <input
      data-testid="hex-color-picker"
      value={color}
      onChange={e => onChange(e.target.value)}
      readOnly={false}
    />
  ),
  HexColorInput: ({ color, onChange }) => (
    <input
      data-testid="hex-color-input"
      value={color}
      onChange={e => onChange(e.target.value)}
      readOnly={false}
    />
  ),
}))

const PRESETS = [
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#F59E0B', name: 'Amber' },
]

describe('ColorPicker — preset swatches', () => {
  it('renders a button for each preset', () => {
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /indigo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /amber/i })).toBeInTheDocument()
  })

  it('marks the selected preset with aria-pressed=true', () => {
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /indigo.*selected/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^amber$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the preset hex when a preset is clicked', () => {
    const onChange = vi.fn()
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^amber$/i }))
    expect(onChange).toHaveBeenCalledWith('#F59E0B')
  })
})

describe('ColorPicker — custom color button', () => {
  it('renders a custom color trigger button', () => {
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^custom color$/i })).toBeInTheDocument()
  })

  it('opens the color picker panel when the custom button is clicked', () => {
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^custom color$/i }))
    expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument()
  })

  it('marks custom trigger as aria-pressed=true when a non-preset color is selected', () => {
    render(<ColorPicker presets={PRESETS} value="#AABBCC" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /custom color.*selected/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange when a color is changed in the custom picker', () => {
    const onChange = vi.fn()
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^custom color$/i }))
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#AABBCC' } })
    expect(onChange).toHaveBeenCalledWith('#AABBCC')
  })

  it('closes picker on Escape key', () => {
    render(<ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^custom color$/i }))
    expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument()
  })
})

describe('ColorPicker — group label', () => {
  it('has role="group" with the provided label', () => {
    render(
      <ColorPicker presets={PRESETS} value="#6366F1" onChange={vi.fn()} label="Pick a color" />
    )
    expect(screen.getByRole('group', { name: 'Pick a color' })).toBeInTheDocument()
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function ThrowError({ shouldThrow = false }) {
  if (shouldThrow) throw new Error('Test crash')
  return <div>No error</div>
}

// Module-level flag: lets one test control throw behavior across renders
let controlledThrow = false
function ControlledThrow() {
  if (controlledThrow) throw new Error('Controlled crash')
  return <div>Clean render</div>
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  console.error.mockRestore()
})

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('displays the error message in the fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Test crash')).toBeInTheDocument()
  })

  it('renders a "Try again" button in the error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('"Try again" clears the error state so non-throwing children can render', () => {
    controlledThrow = true
    render(
      <ErrorBoundary>
        <ControlledThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Set the flag false BEFORE the click so the re-render after setState succeeds
    controlledThrow = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText('Clean render')).toBeInTheDocument()
  })
})

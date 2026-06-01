import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('View crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 opacity-80" />
          <div>
            <p className="font-display font-semibold text-appText mb-1">Something went wrong</p>
            <p className="text-xs text-appTextMuted font-mono break-all">{this.state.error.message}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-appInput hover:bg-appCard border border-appBorder text-sm text-appTextMuted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

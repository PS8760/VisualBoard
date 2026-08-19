import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors and shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#faf8f1] px-6 text-center">
          <div className="text-4xl">⚠</div>
          <h1 className="text-xl font-semibold text-[#18202e]">Something went wrong</h1>
          <p className="max-w-md text-sm text-[#5b6472]">{this.state.error.message}</p>
          <button
            className="rounded-lg bg-[#d14009] px-4 py-2 text-sm font-medium text-white hover:bg-[#b83908]"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root-level error boundary that catches unhandled exceptions in the React
 * component tree and shows a recovery UI instead of a white screen.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          backgroundColor: 'var(--bg-color, #1a1a24)',
          color: 'var(--text-color, #e0e0e0)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: '2rem',
            borderRadius: 12,
            backgroundColor: 'var(--sidebar-bg, #16161e)',
            border: '1px solid var(--border-color, #2a2a3a)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary, #888)',
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Your data is safe — try recovering or
            reloading the application.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: 12,
                padding: '0.75rem 1rem',
                borderRadius: 8,
                backgroundColor: 'var(--input-bg, #1e1e2e)',
                color: '#f87171',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 120,
                marginBottom: 16,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={this.handleRecover}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: 8,
                border: '1px solid var(--border-color, #2a2a3a)',
                backgroundColor: 'transparent',
                color: 'var(--text-color, #e0e0e0)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Try to recover
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'var(--accent-color, #6366f1)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

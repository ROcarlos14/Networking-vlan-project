import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error boundary component to catch React errors
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="text-red-500 text-2xl mr-3">⚠️</div>
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>
            
            <p className="text-gray-300 mb-4">
              The VLAN Network Simulator encountered an unexpected error. 
              Please refresh the page to continue.
            </p>
            
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-gray-700 rounded text-sm font-mono">
                  <div className="text-red-400 mb-2">{this.state.error.name}: {this.state.error.message}</div>
                  <div className="text-gray-400 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </div>
                </div>
              </details>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

const isDev = import.meta.env.DEV;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (isDev) {
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }
  }

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md w-full text-center">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Something Went Wrong</h1>
            <p className="text-gray-500 mb-8">
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md"
              >
                <Home size={20} aria-hidden="true" />
                Go Home
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                <RefreshCw size={20} aria-hidden="true" />
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

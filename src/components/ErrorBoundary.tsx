import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called right after "Try again" clears the error, before the children
   *  re-render — e.g. to refetch data that may have caused the crash. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * The last line of defense against a render crash. Without this, React
 * unmounts the whole tree on any uncaught error and the app goes fully
 * blank — no nav, no way back in short of a manual browser refresh. This
 * catches that crash at whichever boundary it's placed on and swaps in a
 * recoverable screen instead, styled to match the rest of the app so it
 * reads as part of the product rather than a browser error page.
 *
 * Must be a class component — getDerivedStateFromError/componentDidCatch
 * have no hook equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught a render error:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
          <div className="max-w-xs w-full text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-negative/12 flex items-center justify-center">
              <AlertTriangle size={22} className="text-negative" />
            </div>
            <h1 className="text-lg font-bold text-ink">Something went wrong</h1>
            <p className="text-sm text-ink-secondary">
              This screen hit a snag. Your data is safe — try again, or reload if it keeps happening.
            </p>
            <div className="flex flex-col gap-2 w-full mt-1">
              <Button onClick={this.reset} fullWidth>
                Try again
              </Button>
              <Button variant="outline" fullWidth onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/hooks/useI18n";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called right after "Try again" clears the error, before the children
   *  re-render — e.g. to refetch data that may have caused the crash. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Renders the crash-recovery screen. Split out from the class component
 *  below so it can call the `useT()` hook — hooks have no equivalent inside
 *  a class component's render/methods. */
function ErrorFallback({ onReset, onReload }: { onReset: () => void; onReload: () => void }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="max-w-xs w-full text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-negative/12 flex items-center justify-center">
          <AlertTriangle size={22} className="text-negative" />
        </div>
        <h1 className="text-lg font-bold text-ink">{t("aiComponents.errorBoundary.title")}</h1>
        <p className="text-sm text-ink-secondary">{t("aiComponents.errorBoundary.message")}</p>
        <div className="flex flex-col gap-2 w-full mt-1">
          <Button onClick={onReset} fullWidth>
            {t("aiComponents.errorBoundary.tryAgain")}
          </Button>
          <Button variant="outline" fullWidth onClick={onReload}>
            {t("aiComponents.errorBoundary.reloadApp")}
          </Button>
        </div>
      </div>
    </div>
  );
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
      return <ErrorFallback onReset={this.reset} onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}

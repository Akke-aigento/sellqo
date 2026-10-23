// HORECA-0 — foutvanger rond de hele app (en rond de schermen die op de vloer draaien).
// Zonder dit gaf één renderfout een wit scherm, ook in de app. Nu: een herstelscherm,
// de fout gaat naar client_errors, en een JS-stuk dat na een deploy niet meer bestaat
// wordt één keer automatisch opnieuw geladen.
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isChunkLoadError, recordRoute, reloadOnceForChunkError, reportClientError } from '@/lib/clientErrors';

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ paddingTop: 'max(1.5rem, var(--safe-top))', paddingBottom: 'max(1.5rem, var(--safe-bottom))' }}>
      <h1 className="text-xl font-bold">{t('errorBoundary.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('errorBoundary.body')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="h-11 rounded-md bg-primary px-5 font-semibold text-primary-foreground">
          {t('errorBoundary.retry')}
        </button>
        <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-md border px-5 font-semibold">
          {t('errorBoundary.reload')}
        </button>
      </div>
    </div>
  );
}

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return;
    void reportClientError({ error, componentStack: info.componentStack, source: 'boundary' });
  }

  componentDidUpdate(prev: Props) {
    // Naar een ander scherm navigeren = opnieuw proberen.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) return <Fallback onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

/** Binnen de router: resetten bij een routewissel en het kruimelspoor bijhouden. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => { recordRoute(location.pathname); }, [location.pathname]);
  return <Boundary resetKey={location.pathname}>{children}</Boundary>;
}

/** Buiten de router (rond de providers): enkel vangen, geen reset op route. */
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  return <Boundary>{children}</Boundary>;
}

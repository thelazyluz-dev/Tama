// Last-resort safety net: if anything throws during render, show a reset screen
// instead of a blank page. (Errors inside the R3F frame loop aren't caught here;
// the store's bootstrap has its own guard for save-load failures.)

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('App error:', error, info.componentStack);
  }

  private reset = (): void => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <h1>משהו השתבש</h1>
            <p>אירעה תקלה בטעינת המשחק. אפשר לאפס ולהתחיל עמק חדש.</p>
            <button type="button" className="return-btn" onClick={this.reset}>
              איפוס והתחלה מחדש
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

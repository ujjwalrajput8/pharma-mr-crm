import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Page';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render crashes so one widget (e.g. calendar) cannot blank the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI crashed', error, info.componentStack);
  }

  public render() {
    if (!this.state.error) return this.props.children;

    return (
      <Card className="space-y-3 p-6">
        <h3 className="text-lg font-semibold text-[var(--color-danger)]">
          {this.props.title ?? 'Something went wrong'}
        </h3>
        <p className="text-sm text-[var(--color-muted)]">{this.state.error.message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
        >
          Reload page
        </Button>
      </Card>
    );
  }
}

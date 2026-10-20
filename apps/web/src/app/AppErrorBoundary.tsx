import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorPage } from '../pages/error/ErrorPage';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Последний рубеж: ошибка рендера не должна оставлять пустой экран.
 * Сетевые и серверные ошибки обрабатываются на местах, сюда попадают только сбои React.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // В консоли нет пользовательских данных — только компонентный стек.
    console.error('Render error', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) return <ErrorPage onRetry={this.reset} />;
    return this.props.children;
  }
}

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { ToastProvider, useToast } from './Toast';

afterEach(() => {
  vi.useRealTimers();
});

describe('Button', () => {
  it('в состоянии loading блокируется и сообщает об этом', () => {
    render(<Button loading>Сохраняем</Button>);

    const button = screen.getByRole('button', { name: /сохраняем/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Input', () => {
  it('связывает подпись, подсказку и ошибку', () => {
    render(<Input label="Email" error="Укажите email" defaultValue="" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Укажите email');
  });
});

describe('Modal', () => {
  function ControlledModal() {
    const [open, setOpen] = useState(true);

    return (
      <Modal open={open} onClose={() => setOpen(false)} title="Заблокировать даты">
        <p>Тело диалога</p>
        <button type="button">Подтвердить</button>
      </Modal>
    );
  }

  it('фокусирует первый элемент и закрывается по Escape', () => {
    render(<ControlledModal />);

    const dialog = screen.getByRole('dialog', { name: 'Заблокировать даты' });
    expect(dialog).toBeInTheDocument();

    const close = screen.getAllByRole('button', { name: 'Закрыть окно' })[1]!;
    const confirm = screen.getByRole('button', { name: 'Подтвердить' });
    expect(close).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    dialog.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function ToastDemo({ tone }: { tone: 'success' | 'error' }) {
    const { show } = useToast();

    return <button onClick={() => show({ title: 'Готово', tone })}>Показать</button>;
  }

  it('закрывает успешное уведомление через 5 секунд', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastDemo tone="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Показать' }));
    expect(screen.getByRole('status')).toHaveTextContent('Готово');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('не закрывает ошибку автоматически', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastDemo tone="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Показать' }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Готово');
  });
});

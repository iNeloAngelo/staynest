import type { ReactNode } from 'react';
import { DialogShell } from './Dialog';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal(props: ModalProps) {
  return <DialogShell {...props} variant="modal" />;
}

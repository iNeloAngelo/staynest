import type { ReactNode } from 'react';
import { DialogShell } from './Dialog';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet(props: BottomSheetProps) {
  return <DialogShell {...props} variant="sheet" />;
}

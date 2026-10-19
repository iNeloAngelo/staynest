import type { ReactNode } from 'react';
import { DialogShell } from './Dialog';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
};

export function BottomSheet(props: BottomSheetProps) {
  return <DialogShell {...props} variant="sheet" />;
}

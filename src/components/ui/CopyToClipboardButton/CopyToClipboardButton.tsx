import { useCallback } from 'react';
import { Button } from 'primereact/button';
import type { ToastMessage } from 'primereact/toast';

interface CopyToClipboardButtonProps {
  value: string;
  valueLabel: string;
  onToast: (message: ToastMessage) => void;
  tooltip?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  ariaLabel?: string;
  className?: string;
}

export const CopyToClipboardButton = ({
  value,
  valueLabel,
  onToast,
  tooltip,
  tooltipPosition = 'top',
  ariaLabel,
  className,
}: CopyToClipboardButtonProps) => {
  const handleCopy = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(value);
      onToast({
        severity: 'success',
        summary: 'Copied',
        detail: `Copied ${valueLabel}: ${value} to clipboard.`,
        life: 2500,
      });
    } catch {
      onToast({
        severity: 'error',
        summary: 'Copy failed',
        detail: `Could not copy ${valueLabel}.`,
        life: 3500,
      });
    }
  }, [onToast, value, valueLabel]);

  return (
    <Button
      type="button"
      size="small"
      text
      rounded
      icon="pi pi-copy"
      className={className}
      onClick={() => void handleCopy()}
      tooltip={tooltip ?? `Copy ${valueLabel}`}
      tooltipOptions={{ position: tooltipPosition }}
      aria-label={ariaLabel ?? `Copy ${valueLabel}`}
    />
  );
};


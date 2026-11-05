import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * Asks before throwing away a half-filled form. `request()` closes straight away
 * when nothing changed; render `dialog` once inside the form.
 */
export function useDiscardGuard(dirty: boolean, onClose: () => void) {
  const [asking, setAsking] = useState(false);
  return {
    request: () => (dirty ? setAsking(true) : onClose()),
    dialog: (
      <ConfirmDialog
        open={asking}
        variant="generic"
        badge="Unsaved"
        title="Discard your changes?"
        description="What you filled in this form will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onClose={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onClose();
        }}
      />
    ),
  };
}

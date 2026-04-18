/** In-app confirmation dialog with an imperative Promise-based API.
 *
 *  Usage:
 *    import { confirm } from '../../components/ui/ConfirmDialog';
 *    if (!(await confirm({
 *      title: 'Delete document?',
 *      description: `"${doc.name}" will be removed. This cannot be undone.`,
 *      confirmText: 'Delete',
 *      tone: 'destructive',
 *    }))) return;
 *
 *  The host component `<ConfirmDialogHost />` must be mounted once at
 *  the app root. Only one confirmation is rendered at a time — if a
 *  second call comes in while one is open, the first resolves `false`.
 *
 *  The `confirm` name intentionally shadows the browser global so the
 *  only diff at each call site is adding `await` and passing an object.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';

export type ConfirmOptions = {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 'destructive' styles the confirm button red (deletes etc.). */
  tone?: 'default' | 'destructive';
};

type PendingState = ConfirmOptions & { resolve: (value: boolean) => void };

let setPendingRef: ((p: PendingState | null) => void) | null = null;
let currentPending: PendingState | null = null;

/** Imperative confirmation prompt. Returns true if the user confirms,
 *  false if they cancel, close the dialog, or press Escape. */
export function confirm(options: ConfirmOptions = {}): Promise<boolean> {
  if (!setPendingRef) {
    // Host not mounted (yet). Fail closed — never silently delete.
    // This also covers unit tests that render a single page without App.
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('<ConfirmDialogHost/> is not mounted; confirm() resolved to false.');
    }
    return Promise.resolve(false);
  }
  // If there's already a pending confirmation, auto-cancel it so the
  // new one takes its place. Promise-leaking is the main failure mode
  // to avoid here.
  if (currentPending) {
    currentPending.resolve(false);
    currentPending = null;
  }
  return new Promise<boolean>(resolve => {
    const pending: PendingState = { ...options, resolve };
    currentPending = pending;
    setPendingRef!(pending);
  });
}

/** Mount once at the app root, alongside <Toaster />. */
export function ConfirmDialogHost() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    setPendingRef = setPending;
    return () => { setPendingRef = null; };
  }, []);

  useEffect(() => {
    resolvedRef.current = false;
  }, [pending]);

  const close = (ok: boolean) => {
    if (!pending || resolvedRef.current) return;
    resolvedRef.current = true;
    pending.resolve(ok);
    currentPending = null;
    setPending(null);
  };

  const isDestructive = pending?.tone === 'destructive';

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) close(false); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? 'Are you sure?'}</AlertDialogTitle>
          {pending?.description !== undefined && pending?.description !== '' && (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelText ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={isDestructive
              ? 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20'
              : undefined}
          >
            {pending?.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

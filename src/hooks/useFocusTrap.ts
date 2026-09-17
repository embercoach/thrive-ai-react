import { useEffect, useRef, type RefObject } from "react";

/**
 * Minimal focus management for a modal/dialog: moves focus into the panel
 * when `open` becomes true, restores it to whatever was focused before the
 * modal opened once it closes, and keeps Tab/Shift+Tab cycling within the
 * panel's own focusable elements instead of leaking out to page content
 * behind the (visually blocking, but not DOM-inert) overlay.
 *
 * Attach the returned ref to the modal's outer panel element and give that
 * element `tabIndex={-1}` — that lets it receive the initial programmatic
 * focus (so a screen reader lands inside the dialog, not wherever focus
 * happened to be on the page behind it) without also joining the normal
 * Tab order itself.
 */
export function useFocusTrap(open: boolean): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = panel!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", handleKeyDown);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return panelRef;
}

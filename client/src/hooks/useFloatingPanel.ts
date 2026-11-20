import { useLayoutEffect, type RefObject } from 'react';

const GAP = 6;
const EDGE = 8;

/**
 * Pins a dropdown panel (`position: fixed`) to its field, so a dialog's scrolling
 * body can't cut it off. Opens upwards when there is more room above, never leaves
 * the screen, and follows the field while anything scrolls. The panel stays inside
 * the field's DOM, so outside-click checks keep working.
 *
 * `matchWidth` makes the panel as wide as the field (lists); otherwise it keeps its
 * own width, lined up with the field's start or end edge (calendars).
 */
export function useFloatingPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  { matchWidth = false, align = 'start' }: { matchWidth?: boolean; align?: 'start' | 'end' } = {},
) {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const box = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (matchWidth) panel.style.width = `${Math.min(box.width, vw - EDGE * 2)}px`;
      const width = Math.min(panel.offsetWidth, vw - EDGE * 2);
      const preferred = align === 'end' ? box.right - width : box.left;
      panel.style.left = `${Math.max(EDGE, Math.min(preferred, vw - width - EDGE))}px`;

      const below = vh - box.bottom - GAP - EDGE;
      const above = box.top - GAP - EDGE;
      const up = panel.scrollHeight > below && above > below;
      panel.style.top = up ? '' : `${box.bottom + GAP}px`;
      panel.style.bottom = up ? `${vh - box.top + GAP}px` : '';
      panel.style.maxHeight = `${Math.max(up ? above : below, 160)}px`;
      panel.style.overflowY = 'auto';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, panelRef, matchWidth, align]);
}

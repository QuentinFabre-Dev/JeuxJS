import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Keeps keyboard focus inside an open dialog and gives it back on close.
 *
 * Without this, Tab walks out of the dialog and roams the page behind it: the
 * focus ring leaves the screen and buttons that are visually covered can still
 * be activated.
 *
 * @param {boolean} isOpen
 * @param {Function} [onEscape] called when Escape is pressed
 * @returns {import('react').RefObject} ref to put on the dialog element
 */
export default function useFocusTrap(isOpen, onEscape) {
  const containerRef = useRef(null);
  // Kept in a ref so an inline callback does not re-run the effect on every
  // render, which would steal the focus back to the first element each time.
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return undefined;

    const previouslyFocused = document.activeElement;
    const visibleFocusables = () =>
      [...container.querySelectorAll(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );

    visibleFocusables()[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        escapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = visibleFocusables();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !container.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    // The dialog is rendered in a portal, so the app root can be made inert:
    // the page behind stops taking clicks and tab stops entirely.
    const root = document.getElementById('root');
    const canInert = root && !root.contains(container);
    if (canInert) root.setAttribute('inert', '');

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (canInert) root.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  return containerRef;
}

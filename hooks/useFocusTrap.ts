import { useEffect, useRef, useCallback } from 'react';

/**
 * useFocusTrap — Prende o foco dentro de um container.
 * Essencial para modais e overlays na TV Box, onde o D-Pad
 * não deve navegar para elementos "atrás" do modal.
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback(() => {
    if (!isActive || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      '[data-nav-item], button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      // Salvar elemento focado antes de abrir o modal
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Pequeno delay para garantir que o DOM do modal renderizou
      const t = setTimeout(trapFocus, 100);
      return () => clearTimeout(t);
    } else {
      // Restaurar foco ao fechar
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isActive, trapFocus]);

  // Impedir que Tab/Shift+Tab saiam do container
  useEffect(() => {
    if (!isActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        '[data-nav-item], button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive]);

  return containerRef;
}

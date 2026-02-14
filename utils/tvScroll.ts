/**
 * tvScroll — Scroll otimizado para TV Box.
 * Considera a "safe area" (overscan) que TVs cortam nas bordas.
 */

// Margem segura para overscan de TVs (em pixels)
const TV_SAFE_MARGIN = 48;

/**
 * Faz scroll suave até o elemento focado,
 * garantindo que ele fique dentro da safe area da TV.
 */
export function scrollToFocusedElement(element: HTMLElement): void {
  // Primeiro: scroll padrão para ficar visível
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
  });

  // Depois: compensar overscan
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();

    // Se o elemento está muito perto do topo (dentro da zona de overscan)
    if (rect.top < TV_SAFE_MARGIN) {
      window.scrollBy({
        top: -(TV_SAFE_MARGIN - rect.top),
        behavior: 'smooth',
      });
    }

    // Se o elemento está muito perto do fundo
    if (rect.bottom > window.innerHeight - TV_SAFE_MARGIN) {
      window.scrollBy({
        top: rect.bottom - window.innerHeight + TV_SAFE_MARGIN,
        behavior: 'smooth',
      });
    }
  });
}

/**
 * Scroll horizontal otimizado dentro de um container de row.
 * Centraliza o elemento focado no container.
 */
export function scrollRowToElement(
  scrollContainer: HTMLElement,
  element: HTMLElement
): void {
  const containerRect = scrollContainer.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();
  const offset = element.offsetLeft - containerRect.width / 2 + elRect.width / 2;
  scrollContainer.scrollTo({
    left: Math.max(0, offset),
    behavior: 'smooth',
  });
}

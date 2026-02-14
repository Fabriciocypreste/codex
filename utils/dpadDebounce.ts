/**
 * Debounce para navegação D-Pad em TV Box.
 * Controles baratos enviam eventos repetidos muito rápido.
 * Este utilitário filtra pressionamentos duplicados.
 */

let lastNavTime = 0;
const NAV_DEBOUNCE_MS = 120; // ms entre navegações

/**
 * Retorna true se o evento de navegação deve ser processado.
 * Retorna false se está dentro do intervalo de debounce.
 */
export function shouldProcessNavEvent(): boolean {
  const now = Date.now();
  if (now - lastNavTime < NAV_DEBOUNCE_MS) return false;
  lastNavTime = now;
  return true;
}

/**
 * Reseta o timer de debounce (útil ao mudar de página)
 */
export function resetNavDebounce(): void {
  lastNavTime = 0;
}

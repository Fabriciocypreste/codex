/**
 * Debounce para navegação D-Pad em TV Box.
 * Controles baratos enviam eventos repetidos muito rápido.
 * Este utilitário filtra pressionamentos duplicados.
 */

let lastNavTime = 0;
let lastVerticalNavTime = 0;
const NAV_DEBOUNCE_MS = 120; // ms entre navegações (horizontal)
const NAV_VERTICAL_DEBOUNCE_MS = 220; // ms entre seta cima/baixo (evita pular linhas)

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

/** Debounce mais longo para seta cima/baixo — evita pular linhas na Home */
export function shouldProcessVerticalNavEvent(): boolean {
  const now = Date.now();
  if (now - lastVerticalNavTime < NAV_VERTICAL_DEBOUNCE_MS) return false;
  lastVerticalNavTime = now;
  lastNavTime = now;
  return true;
}

/**
 * Reseta o timer de debounce (útil ao mudar de página)
 */
export function resetNavDebounce(): void {
  lastNavTime = 0;
  lastVerticalNavTime = 0;
}

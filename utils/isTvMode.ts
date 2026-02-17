/**
 * Detecta se o app está rodando em modo TV (controle remoto D-pad).
 * Usado para exibir anel de foco, desativar scroll por setas em desktop, etc.
 * Em Capacitor Android TV, o D-pad é injetado pela MainActivity; esta flag
 * pode ser usada para UI (ex.: classe .show-focus).
 */
let cached: boolean | null = null;

export function isTvMode(): boolean {
  if (cached !== null) return cached;

  if (typeof navigator === 'undefined') {
    cached = false;
    return cached;
  }

  const ua = navigator.userAgent.toLowerCase();

  // Capacitor Android (TV Box costuma ter "Android" e às vezes "TV" no UA)
  if (ua.indexOf('android') !== -1 && (ua.indexOf('tv') !== -1 || ua.indexOf('aftm') !== -1)) {
    cached = true;
    return cached;
  }

  // Tizen, WebOS, Viera (referência Jellyfin)
  if (ua.indexOf('tv') !== -1 || ua.indexOf('samsungbrowser') !== -1 || ua.indexOf('viera') !== -1) {
    cached = true;
    return cached;
  }

  if (ua.indexOf('web0s') !== -1 || ua.indexOf('netcast') !== -1) {
    cached = true;
    return cached;
  }

  // Opcional: Capacitor.getPlatform() === 'android' em app apenas TV
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    if (cap?.getPlatform?.() === 'android') {
      // Pode ser phone ou TV; não assumir TV só por ser Android
      cached = false;
      return cached;
    }
  } catch {
    // ignore
  }

  cached = false;
  return cached;
}

export function setTvMode(value: boolean): void {
  cached = value;
}

import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativePlayerPlugin {
  play(options: { url: string; title?: string; position?: number; isLive?: boolean }): Promise<{ position: number }>;
}

const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer');

/**
 * Verifica se estamos rodando em plataforma nativa (Android/iOS).
 * Se sim, podemos usar o ExoPlayer nativo em vez do <video> do WebView.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Reproduz um vídeo usando o ExoPlayer nativo do Android.
 * Abre uma Activity fullscreen com controles de D-pad.
 * Retorna a posição final em segundos quando o usuário fecha o player.
 */
export async function playNative(
  url: string,
  title?: string,
  position?: number,
  isLive?: boolean
): Promise<number> {
  try {
    const result = await NativePlayer.play({
      url,
      title: title || '',
      position: position || 0,
      isLive: isLive || false,
    });
    return result.position || 0;
  } catch (err) {
    console.error('[NativePlayer] Erro:', err);
    return 0;
  }
}

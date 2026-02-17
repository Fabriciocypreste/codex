import Hls, { Level, ErrorData, HlsConfig } from 'hls.js';

/**
 * HLS Streaming Service v2 — RED X Spatial Streaming
 * ════════════════════════════════════════════════════════
 * ABR adaptativo, seleção manual de qualidade (240p–4K),
 * detecção de velocidade de rede, retry com 3 tentativas,
 * buffer otimizado para TV Box, transições suaves de qualidade.
 */

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════

export interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
  codec?: string;
}

export interface StreamStats {
  /** Velocidade estimada da rede (Mbps) */
  networkSpeed: number;
  /** Nível de qualidade atual */
  currentLevel: number;
  /** Nível de qualidade sendo carregado */
  loadingLevel: number;
  /** Quantidade de buffer disponível (segundos) */
  bufferLength: number;
  /** Latência estimada da rede (ms) */
  latency: number;
  /** Contagem de erros recuperados */
  recoveredErrors: number;
  /** Total de bytes baixados */
  totalBytesLoaded: number;
  /** Indica se ABR automático está ativo */
  isAutoQuality: boolean;
  /** Indica se o stream está em buffer (stalling) */
  isBuffering: boolean;
}

export interface HlsStreamingCallbacks {
  onQualityLevelsReady?: (levels: QualityLevel[]) => void;
  onQualityChanged?: (level: QualityLevel) => void;
  onStatsUpdate?: (stats: StreamStats) => void;
  onManifestParsed?: () => void;
  onError?: (fatal: boolean, details: string) => void;
  onRecovery?: (attempt: number, maxAttempts: number) => void;
  onFatalError?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
}

type QualityMode = 'auto' | 'manual';

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const STATS_UPDATE_INTERVAL = 2000;
const NETWORK_SAMPLE_WINDOW = 5; // Últimas N amostras para média móvel

/** Labels amigáveis por altura do vídeo */
const QUALITY_LABELS: Record<number, string> = {
  2160: '4K Ultra HD',
  1440: '2K QHD',
  1080: 'Full HD',
  720:  'HD',
  480:  'SD',
  360:  '360p',
  240:  '240p',
};

function getQualityLabel(height: number): string {
  // Achar o label mais próximo
  const heights = Object.keys(QUALITY_LABELS).map(Number).sort((a, b) => b - a);
  for (const h of heights) {
    if (height >= h - 40) return QUALITY_LABELS[h];
  }
  return `${height}p`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

// ═══════════════════════════════════════════════════════
// CLASSE PRINCIPAL
// ═══════════════════════════════════════════════════════

export class HlsStreamingManager {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private callbacks: HlsStreamingCallbacks = {};
  private qualityLevels: QualityLevel[] = [];
  private qualityMode: QualityMode = 'auto';
  private retryCount = 0;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private networkSamples: number[] = [];
  private recoveredErrors = 0;
  private totalBytesLoaded = 0;
  private isBuffering = false;
  private destroyed = false;
  private currentUrl = '';

  // ═══ CONFIG TV BOX OTIMIZADA ═══
  private static readonly TV_BOX_CONFIG: Partial<HlsConfig> = {
    // Buffer otimizado para VOD em TV Box
    maxBufferLength: 30,             // 30s de buffer máximo
    maxMaxBufferLength: 60,          // Teto absoluto 60s
    maxBufferSize: 60 * 1000 * 1000, // 60MB máximo em memória
    maxBufferHole: 0.5,              // Tolerância de 0.5s para buracos no buffer

    // ABR — transição suave de qualidade
    capLevelToPlayerSize: true,      // Ajusta qualidade ao tamanho real do player (TV Box)
    startLevel: -1,                  // Auto-detect nível inicial
    abrEwmaDefaultEstimate: 500_000, // Estimativa inicial 500Kbps (conservador)
    abrEwmaFastLive: 3,             // Fator de decay rápido
    abrEwmaSlowLive: 9,             // Fator de decay lento
    abrBandWidthFactor: 0.8,        // Usar 80% da banda estimada (margem segurança)
    abrBandWidthUpFactor: 0.7,      // Subir qualidade com mais cautela
    abrMaxWithRealBitrate: true,    // Considerar bitrate real (não estimado)

    // Worker e performance
    enableWorker: true,
    lowLatencyMode: false,           // VOD — sem necessidade de baixa latência

    // Fragmentos
    maxFragLookUpTolerance: 0.25,
    startFragPrefetch: true,         // Pre-buscar primeiro fragmento

    // Nível de retry interno do HLS.js
    fragLoadingMaxRetry: 3,
    fragLoadingRetryDelay: 1000,
    manifestLoadingMaxRetry: 3,
    manifestLoadingRetryDelay: 1000,
    levelLoadingMaxRetry: 3,
    levelLoadingRetryDelay: 1000,

    // Timeouts mais tolerantes para TV Box (rede potencialmente lenta)
    fragLoadingTimeOut: 20000,
    manifestLoadingTimeOut: 15000,
    levelLoadingTimeOut: 15000,

    // Playlists
    liveSyncDurationCount: 3,
    liveDurationInfinity: false,

    // Capabilitytest do navegador
    testBandwidth: true,

    // Progressive loading para fragmentos grandes
    progressive: true,
  };

  // ═══════════════════════════════════════════════════════
  // INICIALIZAÇÃO
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica se o navegador suporta HLS.js
   */
  static isSupported(): boolean {
    return Hls.isSupported();
  }

  /**
   * Verifica se o navegador tem suporte nativo a HLS (Safari/iOS)
   */
  static hasNativeHlsSupport(video: HTMLVideoElement): boolean {
    return !!video.canPlayType('application/vnd.apple.mpegurl');
  }

  /**
   * Inicializa o streaming HLS para o elemento de vídeo dado.
   * Retorna true se a inicialização foi bem sucedida.
   */
  initialize(
    videoElement: HTMLVideoElement,
    url: string,
    callbacks: HlsStreamingCallbacks = {}
  ): boolean {
    this.destroy(); // Limpar instância anterior

    this.videoElement = videoElement;
    this.callbacks = callbacks;
    this.currentUrl = url;
    this.retryCount = 0;
    this.recoveredErrors = 0;
    this.totalBytesLoaded = 0;
    this.networkSamples = [];
    this.destroyed = false;
    this.qualityMode = 'auto';
    this.qualityLevels = [];
    this.isBuffering = false;

    if (!Hls.isSupported()) {
      // Safari nativo
      if (HlsStreamingManager.hasNativeHlsSupport(videoElement)) {
        videoElement.src = url;
        console.log('[HlsStreaming] Usando HLS nativo (Safari)');
        return true;
      }
      console.error('[HlsStreaming] HLS não suportado neste navegador');
      callbacks.onFatalError?.();
      return false;
    }

    this.hls = new Hls(HlsStreamingManager.TV_BOX_CONFIG as Partial<HlsConfig>);
    this.attachEvents();
    this.hls.loadSource(url);
    this.hls.attachMedia(videoElement);
    this.startStatsMonitor();

    console.log('[HlsStreaming] ✓ Inicializado com config TV Box otimizada');
    return true;
  }

  // ═══════════════════════════════════════════════════════
  // EVENTOS HLS
  // ═══════════════════════════════════════════════════════

  private attachEvents(): void {
    if (!this.hls) return;

    // ── Manifest carregado: níveis de qualidade disponíveis ──
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.qualityLevels = this.parseLevels(data.levels);
      console.log(`[HlsStreaming] Manifest parsed — ${this.qualityLevels.length} qualidades disponíveis`);
      this.qualityLevels.forEach(q =>
        console.log(`  [${q.index}] ${q.label} (${q.width}x${q.height}) ${formatBitrate(q.bitrate)}`)
      );
      this.callbacks.onQualityLevelsReady?.(this.qualityLevels);
      this.callbacks.onManifestParsed?.();

      // Autoplay
      this.videoElement?.play().catch(() => {});
    });

    // ── Mudança de nível ──
    this.hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = this.qualityLevels.find(q => q.index === data.level);
      if (level) {
        console.log(`[HlsStreaming] Qualidade → ${level.label} (${formatBitrate(level.bitrate)})`);
        this.callbacks.onQualityChanged?.(level);
      }
    });

    // ── Progresso de fragmento (para medir velocidade de rede) ──
    this.hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      const stats = data.frag.stats;
      if (stats.total > 0 && stats.loading.end > stats.loading.start) {
        const durationMs = stats.loading.end - stats.loading.start;
        const bytes = stats.total;
        const bitsPerSecond = (bytes * 8) / (durationMs / 1000);
        const mbps = bitsPerSecond / 1_000_000;

        this.totalBytesLoaded += bytes;
        this.networkSamples.push(mbps);
        if (this.networkSamples.length > NETWORK_SAMPLE_WINDOW) {
          this.networkSamples.shift();
        }
      }
    });

    // ── Buffering detection ──
    this.hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (this.isBuffering) {
        this.isBuffering = false;
        this.callbacks.onBuffering?.(false);
      }
    });

    // ── Erros ──
    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      this.handleHlsError(data);
    });
  }

  // ═══════════════════════════════════════════════════════
  // TRATAMENTO DE ERROS COM RETRY
  // ═══════════════════════════════════════════════════════

  private handleHlsError(data: ErrorData): void {
    if (this.destroyed) return;

    const { type, details, fatal } = data;
    console.warn(`[HlsStreaming] Erro ${fatal ? 'FATAL' : 'não-fatal'}: ${type} — ${details}`);

    this.callbacks.onError?.(fatal, details);

    if (!fatal) {
      // Erro não-fatal: registrar e continuar
      this.recoveredErrors++;
      return;
    }

    // ── FATAL: tentar recovery ──
    this.retryCount++;

    if (this.retryCount > MAX_RETRY_ATTEMPTS) {
      console.error(`[HlsStreaming] ✗ ${MAX_RETRY_ATTEMPTS} tentativas esgotadas. Desistindo.`);
      this.callbacks.onFatalError?.();
      return;
    }

    console.log(`[HlsStreaming] Tentativa de recuperação ${this.retryCount}/${MAX_RETRY_ATTEMPTS}...`);
    this.callbacks.onRecovery?.(this.retryCount, MAX_RETRY_ATTEMPTS);

    const delay = RETRY_DELAY_MS * this.retryCount; // Backoff linear
    setTimeout(() => {
      if (this.destroyed || !this.hls) return;

      switch (type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.log('[HlsStreaming] Recuperando erro de rede — reiniciando carregamento...');
          this.hls.startLoad();
          break;

        case Hls.ErrorTypes.MEDIA_ERROR:
          console.log('[HlsStreaming] Recuperando erro de mídia — recoverMediaError()...');
          this.hls.recoverMediaError();
          break;

        default:
          // Para outros erros fatais, destruir e recriar a instância inteira
          console.log('[HlsStreaming] Erro desconhecido — recriando instância HLS...');
          this.recreateInstance();
          break;
      }
    }, delay);
  }

  /**
   * Destrói e recria a instância HLS do zero (último recurso de recuperação)
   */
  private recreateInstance(): void {
    if (this.destroyed || !this.videoElement || !this.currentUrl) return;

    const savedTime = this.videoElement.currentTime;
    const wasPlaying = !this.videoElement.paused;

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.hls = new Hls(HlsStreamingManager.TV_BOX_CONFIG as Partial<HlsConfig>);
    this.attachEvents();
    this.hls.loadSource(this.currentUrl);
    this.hls.attachMedia(this.videoElement);

    // Restaurar posição após recriação
    const onManifest = () => {
      if (this.videoElement && savedTime > 0) {
        this.videoElement.currentTime = savedTime;
        if (wasPlaying) this.videoElement.play().catch(() => {});
      }
      this.hls?.off(Hls.Events.MANIFEST_PARSED, onManifest);
    };
    this.hls.on(Hls.Events.MANIFEST_PARSED, onManifest);

    console.log('[HlsStreaming] ✓ Instância recriada com sucesso');
  }

  // ═══════════════════════════════════════════════════════
  // QUALIDADE — ABR & MANUAL
  // ═══════════════════════════════════════════════════════

  /**
   * Retorna os níveis de qualidade disponíveis
   */
  getQualityLevels(): QualityLevel[] {
    return [...this.qualityLevels];
  }

  /**
   * Volta para ABR automático
   */
  setAutoQuality(): void {
    if (!this.hls) return;
    this.qualityMode = 'auto';
    this.hls.currentLevel = -1; // -1 = ABR automático
    this.hls.nextLevel = -1;
    console.log('[HlsStreaming] Qualidade → Automática (ABR)');
  }

  /**
   * Define um nível de qualidade manual (0-based index)
   * Usa nextLevel para transição suave (sem interrupção de playback)
   */
  setQualityLevel(levelIndex: number): void {
    if (!this.hls) return;

    const level = this.qualityLevels.find(q => q.index === levelIndex);
    if (!level) {
      console.warn(`[HlsStreaming] Nível ${levelIndex} não encontrado`);
      return;
    }

    this.qualityMode = 'manual';
    // nextLevel = transição suave (aplica no próximo fragmento)
    // currentLevel = transição imediata (pode causar glitch)
    this.hls.nextLevel = levelIndex;
    console.log(`[HlsStreaming] Qualidade manual → ${level.label} (${formatBitrate(level.bitrate)})`);
  }

  /**
   * Define qualidade por resolução (ex: 720, 1080, 2160)
   */
  setQualityByHeight(targetHeight: number): void {
    const level = this.qualityLevels.find(q => q.height === targetHeight);
    if (level) {
      this.setQualityLevel(level.index);
    } else {
      // Achar o nível mais próximo
      const closest = this.qualityLevels.reduce((prev, curr) =>
        Math.abs(curr.height - targetHeight) < Math.abs(prev.height - targetHeight) ? curr : prev
      );
      if (closest) this.setQualityLevel(closest.index);
    }
  }

  /**
   * Modo de qualidade atual
   */
  getQualityMode(): QualityMode {
    return this.qualityMode;
  }

  /**
   * Nível de qualidade atualmente ativo
   */
  getCurrentQuality(): QualityLevel | null {
    if (!this.hls) return null;
    const idx = this.hls.currentLevel;
    return this.qualityLevels.find(q => q.index === idx) || null;
  }

  /**
   * Retorna se o ABR automático está ativo
   */
  isAutoQuality(): boolean {
    return this.qualityMode === 'auto';
  }

  // ═══════════════════════════════════════════════════════
  // DETECÇÃO DE VELOCIDADE DE REDE
  // ═══════════════════════════════════════════════════════

  /**
   * Velocidade média da rede (Mbps) com média móvel
   */
  getNetworkSpeed(): number {
    if (this.networkSamples.length === 0) return 0;
    const sum = this.networkSamples.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.networkSamples.length) * 100) / 100;
  }

  /**
   * Classificação da velocidade de rede
   */
  getNetworkClass(): 'excellent' | 'good' | 'fair' | 'poor' {
    const speed = this.getNetworkSpeed();
    if (speed >= 10) return 'excellent';
    if (speed >= 5) return 'good';
    if (speed >= 2) return 'fair';
    return 'poor';
  }

  /**
   * Estima a qualidade máxima possível dada a velocidade de rede
   */
  getRecommendedMaxQuality(): QualityLevel | null {
    const speed = this.getNetworkSpeed();
    if (speed <= 0 || this.qualityLevels.length === 0) return null;

    const speedBps = speed * 1_000_000;
    // Encontrar o nível mais alto cujo bitrate fica abaixo de 80% da velocidade
    const eligible = this.qualityLevels
      .filter(q => q.bitrate <= speedBps * 0.8)
      .sort((a, b) => b.bitrate - a.bitrate);

    return eligible[0] || this.qualityLevels[this.qualityLevels.length - 1];
  }

  // ═══════════════════════════════════════════════════════
  // STATS MONITOR
  // ═══════════════════════════════════════════════════════

  private startStatsMonitor(): void {
    this.stopStatsMonitor();

    this.statsTimer = setInterval(() => {
      if (this.destroyed || !this.hls || !this.videoElement) return;

      // Detectar buffering
      const buffered = this.videoElement.buffered;
      let bufferLength = 0;
      if (buffered.length > 0) {
        const ct = this.videoElement.currentTime;
        for (let i = 0; i < buffered.length; i++) {
          if (ct >= buffered.start(i) && ct <= buffered.end(i)) {
            bufferLength = buffered.end(i) - ct;
            break;
          }
        }
      }

      // Detectar stall
      const wasBuffering = this.isBuffering;
      this.isBuffering = bufferLength < 0.5 && !this.videoElement.paused && !this.videoElement.ended;
      if (this.isBuffering !== wasBuffering) {
        this.callbacks.onBuffering?.(this.isBuffering);
      }

      const stats: StreamStats = {
        networkSpeed: this.getNetworkSpeed(),
        currentLevel: this.hls.currentLevel,
        loadingLevel: this.hls.nextLoadLevel,
        bufferLength: Math.round(bufferLength * 10) / 10,
        latency: this.estimateLatency(),
        recoveredErrors: this.recoveredErrors,
        totalBytesLoaded: this.totalBytesLoaded,
        isAutoQuality: this.qualityMode === 'auto',
        isBuffering: this.isBuffering,
      };

      this.callbacks.onStatsUpdate?.(stats);
    }, STATS_UPDATE_INTERVAL);
  }

  private stopStatsMonitor(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private estimateLatency(): number {
    // Usar as amostras de fragmento para calcular latência média
    if (this.networkSamples.length < 2) return 0;
    // Latência aproximada baseada na variação de velocidade
    const avg = this.getNetworkSpeed();
    const variance = this.networkSamples.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / this.networkSamples.length;
    return Math.round(Math.sqrt(variance) * 100); // ms estimados
  }

  // ═══════════════════════════════════════════════════════
  // PARSER DE NÍVEIS
  // ═══════════════════════════════════════════════════════

  private parseLevels(levels: Level[]): QualityLevel[] {
    return levels.map((level, index) => ({
      index,
      height: level.height,
      width: level.width,
      bitrate: level.bitrate,
      label: getQualityLabel(level.height),
      codec: level.videoCodec || undefined,
    })).sort((a, b) => b.height - a.height); // Ordenar do maior pro menor
  }

  // ═══════════════════════════════════════════════════════
  // CONTROLE DE BUFFER
  // ═══════════════════════════════════════════════════════

  /**
   * Ajusa o tamanho do buffer dinamicamente (útil para TV Box com pouca RAM)
   */
  setBufferConfig(maxBufferLength: number, maxMaxBufferLength: number): void {
    if (!this.hls) return;
    this.hls.config.maxBufferLength = maxBufferLength;
    this.hls.config.maxMaxBufferLength = maxMaxBufferLength;
    console.log(`[HlsStreaming] Buffer config → ${maxBufferLength}s / ${maxMaxBufferLength}s`);
  }

  // ═══════════════════════════════════════════════════════
  // DESTRUIÇÃO
  // ═══════════════════════════════════════════════════════

  /**
   * Destrói a instância HLS e libera recursos
   */
  destroy(): void {
    this.destroyed = true;
    this.stopStatsMonitor();

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.videoElement = null;
    this.qualityLevels = [];
    this.networkSamples = [];
    this.callbacks = {};

    console.log('[HlsStreaming] ✗ Instância destruída');
  }

  /**
   * Referência interna do HLS.js (para uso avançado)
   */
  getHlsInstance(): Hls | null {
    return this.hls;
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON — Instância global reutilizável
// ═══════════════════════════════════════════════════════

let _instance: HlsStreamingManager | null = null;

export function getHlsStreamingManager(): HlsStreamingManager {
  if (!_instance) {
    _instance = new HlsStreamingManager();
  }
  return _instance;
}

export function destroyHlsStreamingManager(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}

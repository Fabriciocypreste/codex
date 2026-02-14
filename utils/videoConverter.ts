/**
 * videoConverter.ts — Utilidades para Preparação de Vídeos P2P
 * ════════════════════════════════════════════════════════════
 * Processo:
 *  1. Admin faz upload de vídeo
 *  2. Gera metadados para P2P (chunks, hashes)
 *  3. Armazena metadados no Supabase
 *  4. Chunks distribuídos via P2P + CDN
 *
 * NOTA: Transcoding real requer FFmpeg (server-side via Edge Function
 * ou serviço externo). Este módulo gerencia apenas os metadados
 * e a preparação de chunks no lado do cliente.
 */

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════

export interface VideoChunkMeta {
  index: number;
  offset: number;    // byte offset no arquivo original
  size: number;      // tamanho em bytes
  duration: number;  // duração aproximada em segundos
  hash: string;      // SHA-256 do chunk
}

export interface VideoP2PMeta {
  contentId: string;
  title: string;
  type: 'movie' | 'series';
  totalSize: number;
  totalDuration: number;
  chunkSize: number; // tamanho padrão do chunk
  chunks: VideoChunkMeta[];
  format: 'hls' | 'mp4' | 'webm';
  resolution: string; // "1920x1080"
  bitrate: number;    // kbps estimado
  createdAt: number;
  magnetLink?: string;
}

export interface TranscodeOptions {
  targetResolutions: string[];  // ["1080p", "720p", "480p"]
  format: 'hls' | 'mp4';
  hlsSegmentDuration: number;   // segundos
  videoBitrate: number;         // kbps
  audioBitrate: number;         // kbps
  audioCodec: string;           // "aac"
  videoCodec: string;           // "h264"
}

export interface ConversionProgress {
  stage: 'analyzing' | 'chunking' | 'hashing' | 'uploading' | 'complete' | 'error';
  percent: number;
  currentChunk: number;
  totalChunks: number;
  message: string;
}

type ProgressCallback = (progress: ConversionProgress) => void;

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_TRANSCODE_OPTIONS: TranscodeOptions = {
  targetResolutions: ['1080p', '720p', '480p'],
  format: 'hls',
  hlsSegmentDuration: 6,
  videoBitrate: 4000,
  audioBitrate: 128,
  audioCodec: 'aac',
  videoCodec: 'h264',
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Gera hash SHA-256 de um ArrayBuffer */
async function hashChunk(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Estima resolução a partir de largura */
function estimateResolution(width: number, height: number): string {
  return `${width}x${height}`;
}

/** Estima bitrate a partir do tamanho e duração */
function estimateBitrate(totalBytes: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((totalBytes * 8) / durationSeconds / 1000); // kbps
}

/** Formata bytes para exibição */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Formata duração em segundos para mm:ss ou hh:mm:ss */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════
// ANALISADOR DE VÍDEO
// ═══════════════════════════════════════════════════════

/**
 * Analisa metadados de um arquivo de vídeo usando HTML5 Video API
 */
export async function analyzeVideoFile(file: File): Promise<{
  duration: number;
  width: number;
  height: number;
  codec: string;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      const result = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        codec: file.type || 'video/mp4',
        size: file.size,
      };
      URL.revokeObjectURL(url);
      video.remove();
      resolve(result);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      video.remove();
      reject(new Error('Não foi possível analisar o vídeo'));
    };
  });
}

// ═══════════════════════════════════════════════════════
// CHUNKING
// ═══════════════════════════════════════════════════════

/**
 * Divide um arquivo de vídeo em chunks e gera metadados P2P
 */
export async function prepareVideoForP2P(
  file: File,
  contentId: string,
  options?: {
    title?: string;
    type?: 'movie' | 'series';
    chunkSize?: number;
    onProgress?: ProgressCallback;
  }
): Promise<VideoP2PMeta> {
  const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
  const onProgress = options?.onProgress;

  // 1. Analisar vídeo
  onProgress?.({
    stage: 'analyzing',
    percent: 0,
    currentChunk: 0,
    totalChunks: 0,
    message: 'Analisando vídeo...',
  });

  let videoMeta = { duration: 0, width: 0, height: 0, codec: '', size: file.size };
  try {
    videoMeta = await analyzeVideoFile(file);
  } catch {
    // Se não conseguir analisar, prosseguir com dados parciais
  }

  // 2. Calcular chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  const chunkDuration = videoMeta.duration > 0 ? videoMeta.duration / totalChunks : 0;

  onProgress?.({
    stage: 'chunking',
    percent: 5,
    currentChunk: 0,
    totalChunks,
    message: `Preparando ${totalChunks} chunks...`,
  });

  // 3. Processar chunks (ler + gerar hash)
  const chunks: VideoChunkMeta[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const end = Math.min(offset + chunkSize, file.size);
    const blob = file.slice(offset, end);

    onProgress?.({
      stage: 'hashing',
      percent: 5 + Math.round((i / totalChunks) * 90),
      currentChunk: i + 1,
      totalChunks,
      message: `Processando chunk ${i + 1}/${totalChunks}...`,
    });

    // Ler chunk como ArrayBuffer
    const data = await blob.arrayBuffer();
    const hash = await hashChunk(data);

    chunks.push({
      index: i,
      offset,
      size: end - offset,
      duration: chunkDuration,
      hash,
    });
  }

  // 4. Gerar metadados completos
  const meta: VideoP2PMeta = {
    contentId,
    title: options?.title || file.name,
    type: options?.type || 'movie',
    totalSize: file.size,
    totalDuration: videoMeta.duration,
    chunkSize,
    chunks,
    format: file.name.endsWith('.m3u8') ? 'hls' : file.name.endsWith('.webm') ? 'webm' : 'mp4',
    resolution: estimateResolution(videoMeta.width, videoMeta.height),
    bitrate: estimateBitrate(file.size, videoMeta.duration),
    createdAt: Date.now(),
  };

  onProgress?.({
    stage: 'complete',
    percent: 100,
    currentChunk: totalChunks,
    totalChunks,
    message: 'Preparação concluída!',
  });

  return meta;
}

// ═══════════════════════════════════════════════════════
// GERAÇÃO DE FFMPEG COMMANDS (para uso server-side)
// ═══════════════════════════════════════════════════════

/**
 * Gera o comando FFmpeg para transcodificação HLS
 * Este comando deve ser executado no servidor (Edge Function)
 */
export function generateFFmpegCommand(
  inputPath: string,
  outputDir: string,
  options?: Partial<TranscodeOptions>
): string {
  const opts = { ...DEFAULT_TRANSCODE_OPTIONS, ...options };

  const resolutionMap: Record<string, { w: number; h: number; br: number }> = {
    '2160p': { w: 3840, h: 2160, br: 15000 },
    '1080p': { w: 1920, h: 1080, br: 4000 },
    '720p':  { w: 1280, h: 720, br: 2500 },
    '480p':  { w: 854, h: 480, br: 1000 },
    '360p':  { w: 640, h: 360, br: 600 },
  };

  if (opts.format === 'hls') {
    // Multi-bitrate HLS com master playlist
    const variantStreams = opts.targetResolutions.map((res, i) => {
      const config = resolutionMap[res] || resolutionMap['720p'];
      return [
        `-map 0:v:0 -map 0:a:0`,
        `-c:v:${i} libx264 -b:v:${i} ${config.br}k`,
        `-s:v:${i} ${config.w}x${config.h}`,
        `-c:a:${i} ${opts.audioCodec} -b:a:${i} ${opts.audioBitrate}k`,
      ].join(' ');
    });

    return [
      `ffmpeg -i "${inputPath}"`,
      ...variantStreams,
      `-f hls`,
      `-hls_time ${opts.hlsSegmentDuration}`,
      `-hls_playlist_type vod`,
      `-hls_flags independent_segments`,
      `-master_pl_name master.m3u8`,
      `-var_stream_map "${opts.targetResolutions.map((_, i) => `v:${i},a:${i}`).join(' ')}"`,
      `"${outputDir}/stream_%v/playlist.m3u8"`,
    ].join(' \\\n  ');
  }

  // MP4 simples
  return [
    `ffmpeg -i "${inputPath}"`,
    `-c:v libx264 -b:v ${opts.videoBitrate}k`,
    `-c:a ${opts.audioCodec} -b:a ${opts.audioBitrate}k`,
    `-movflags +faststart`,
    `"${outputDir}/output.mp4"`,
  ].join(' \\\n  ');
}

/**
 * Gera comandos FFmpeg para todas as resoluções
 */
export function generateTranscodeCommands(
  inputPath: string,
  outputDir: string,
  options?: Partial<TranscodeOptions>
): string[] {
  const opts = { ...DEFAULT_TRANSCODE_OPTIONS, ...options };

  return opts.targetResolutions.map(res => {
    const resolutionMap: Record<string, { w: number; h: number; br: number }> = {
      '2160p': { w: 3840, h: 2160, br: 15000 },
      '1080p': { w: 1920, h: 1080, br: 4000 },
      '720p':  { w: 1280, h: 720, br: 2500 },
      '480p':  { w: 854, h: 480, br: 1000 },
      '360p':  { w: 640, h: 360, br: 600 },
    };

    const config = resolutionMap[res] || resolutionMap['720p'];

    return [
      `ffmpeg -i "${inputPath}"`,
      `-c:v libx264 -b:v ${config.br}k`,
      `-s ${config.w}x${config.h}`,
      `-c:a ${opts.audioCodec} -b:a ${opts.audioBitrate}k`,
      `-f hls -hls_time ${opts.hlsSegmentDuration}`,
      `-hls_playlist_type vod`,
      `-hls_flags independent_segments`,
      `"${outputDir}/${res}/playlist.m3u8"`,
    ].join(' ');
  });
}

// ═══════════════════════════════════════════════════════
// VERIFICAÇÃO DE INTEGRIDADE
// ═══════════════════════════════════════════════════════

/**
 * Verifica integridade de um chunk comparando com o hash esperado
 */
export async function verifyChunk(
  data: ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await hashChunk(data);
  return actualHash === expectedHash;
}

/**
 * Verifica integridade de todos os chunks de um arquivo
 */
export async function verifyFile(
  file: File,
  meta: VideoP2PMeta,
  onProgress?: (percent: number) => void
): Promise<{ valid: boolean; invalidChunks: number[] }> {
  const invalidChunks: number[] = [];

  for (let i = 0; i < meta.chunks.length; i++) {
    const chunk = meta.chunks[i];
    const blob = file.slice(chunk.offset, chunk.offset + chunk.size);
    const data = await blob.arrayBuffer();
    const isValid = await verifyChunk(data, chunk.hash);

    if (!isValid) {
      invalidChunks.push(chunk.index);
    }

    onProgress?.(Math.round(((i + 1) / meta.chunks.length) * 100));
  }

  return {
    valid: invalidChunks.length === 0,
    invalidChunks,
  };
}

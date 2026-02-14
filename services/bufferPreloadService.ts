/**
 * Buffer Pre-loading Service — RED X Spatial Streaming
 * ══════════════════════════════════════════════════════════
 * - Preload dos primeiros 10s do vídeo
 * - Preload de próximo episódio (séries)
 * - Cache de chunks HLS via Cache API (compatível com TV Box)
 * - IndexedDB para armazenar metadados de segmentos
 * - Estratégia LRU (Least Recently Used) para cache
 * - Limite de 500MB de cache
 */

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'redx-hls-segments-v1';
const IDB_NAME = 'redx-buffer-cache';
const IDB_STORE = 'segments';
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const PRELOAD_SECONDS = 10;
const PRELOAD_MAX_SEGMENTS = 5; // Limitar para TV Box com pouca memória

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════

interface CachedSegmentMeta {
  url: string;
  size: number;
  lastAccessed: number;
  createdAt: number;
  contentId: string; // tmdb_id ou title hash
}

interface PreloadStatus {
  state: 'idle' | 'loading' | 'complete' | 'error';
  loadedSegments: number;
  totalSegments: number;
  loadedBytes: number;
}

type PreloadCallback = (status: PreloadStatus) => void;

// ═══════════════════════════════════════════════════════
// IndexedDB MANAGER
// ═══════════════════════════════════════════════════════

class SegmentMetaDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const store = db.createObjectStore(IDB_STORE, { keyPath: 'url' });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('contentId', 'contentId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        console.error('[BufferPreload] IndexedDB open error:', request.error);
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  async put(meta: CachedSegmentMeta): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(url: string): Promise<CachedSegmentMeta | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(url);
      req.onsuccess = () => resolve(req.result as CachedSegmentMeta | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(url: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(): Promise<CachedSegmentMeta[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result as CachedSegmentMeta[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const all = await this.getAll();
    return all.reduce((sum, item) => sum + item.size, 0);
  }

  /** Retorna os itens menos recentemente usados, ordenados do mais antigo */
  async getLRU(count: number): Promise<CachedSegmentMeta[]> {
    const all = await this.getAll();
    return all
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, count);
  }

  async updateAccess(url: string): Promise<void> {
    const meta = await this.get(url);
    if (meta) {
      meta.lastAccessed = Date.now();
      await this.put(meta);
    }
  }

  async getByContentId(contentId: string): Promise<CachedSegmentMeta[]> {
    const all = await this.getAll();
    return all.filter(item => item.contentId === contentId);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// ═══════════════════════════════════════════════════════
// BUFFER PRELOAD MANAGER
// ═══════════════════════════════════════════════════════

export class BufferPreloadManager {
  private metaDB = new SegmentMetaDB();
  private preloadAbortController: AbortController | null = null;
  private nextEpAbortController: AbortController | null = null;
  private currentStatus: PreloadStatus = {
    state: 'idle',
    loadedSegments: 0,
    totalSegments: 0,
    loadedBytes: 0,
  };

  // ═══════════════════════════════════════════════════════
  // PRELOAD INICIAL (primeiros 10s)
  // ═══════════════════════════════════════════════════════

  /**
   * Pré-carrega os primeiros segmentos HLS de uma URL M3U8.
   * Faz parse do manifest, identifica os primeiros N segmentos
   * e os armazena no Cache API.
   */
  async preloadInitialSegments(
    m3u8Url: string,
    contentId: string,
    onStatus?: PreloadCallback
  ): Promise<void> {
    this.cancelPreload();
    this.preloadAbortController = new AbortController();
    const { signal } = this.preloadAbortController;

    this.updateStatus({ state: 'loading', loadedSegments: 0, totalSegments: 0, loadedBytes: 0 }, onStatus);

    try {
      // 1. Buscar M3U8 manifest
      const manifestResp = await fetch(m3u8Url, { signal });
      if (!manifestResp.ok) throw new Error(`Manifest HTTP ${manifestResp.status}`);
      const manifestText = await manifestResp.text();

      // 2. Parsear segmentos do M3U8
      const segments = this.parseM3U8Segments(manifestText, m3u8Url);

      // 3. Calcular quantos segmentos cobrem ~10s
      let accDuration = 0;
      const targetSegments: { url: string; duration: number }[] = [];
      for (const seg of segments) {
        if (accDuration >= PRELOAD_SECONDS || targetSegments.length >= PRELOAD_MAX_SEGMENTS) break;
        targetSegments.push(seg);
        accDuration += seg.duration;
      }

      this.updateStatus({ ...this.currentStatus, totalSegments: targetSegments.length }, onStatus);
      console.log(`[BufferPreload] Preloading ${targetSegments.length} segmentos (~${accDuration.toFixed(1)}s)`);

      // 4. Evict LRU se necessário para liberar espaço
      await this.evictIfNeeded(targetSegments.length * 2_000_000); // Estimativa 2MB/seg

      // 5. Baixar e cachear cada segmento
      const cache = await caches.open(CACHE_NAME);

      for (const seg of targetSegments) {
        if (signal.aborted) break;

        // Verificar se já está em cache
        const cached = await cache.match(seg.url);
        if (cached) {
          this.currentStatus.loadedSegments++;
          this.updateStatus(this.currentStatus, onStatus);
          continue;
        }

        try {
          const resp = await fetch(seg.url, { signal });
          if (!resp.ok) continue;

          const blob = await resp.blob();
          const size = blob.size;

          // Salvar no Cache API
          await cache.put(seg.url, new Response(blob, {
            headers: {
              'Content-Type': 'video/mp2t',
              'X-RedX-ContentId': contentId,
              'X-RedX-Cached': Date.now().toString(),
            },
          }));

          // Salvar metadata no IndexedDB
          await this.metaDB.put({
            url: seg.url,
            size,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
            contentId,
          });

          this.currentStatus.loadedSegments++;
          this.currentStatus.loadedBytes += size;
          this.updateStatus(this.currentStatus, onStatus);
        } catch (err) {
          if (signal.aborted) break;
          console.warn(`[BufferPreload] Falha ao cachear segmento: ${seg.url}`, err);
        }
      }

      this.updateStatus({ ...this.currentStatus, state: signal.aborted ? 'idle' : 'complete' }, onStatus);
      console.log(`[BufferPreload] ✓ Preload completo: ${this.currentStatus.loadedSegments} segmentos, ${formatBytes(this.currentStatus.loadedBytes)}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[BufferPreload] Preload cancelado');
      } else {
        console.error('[BufferPreload] Erro no preload:', err);
        this.updateStatus({ ...this.currentStatus, state: 'error' }, onStatus);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // PRELOAD PRÓXIMO EPISÓDIO
  // ═══════════════════════════════════════════════════════

  /**
   * Pré-carrega os primeiros segmentos do próximo episódio
   * quando o episódio atual está perto do fim (ex: últimos 60s).
   */
  async preloadNextEpisode(
    nextEpUrl: string,
    contentId: string,
    onStatus?: PreloadCallback
  ): Promise<void> {
    // Cancelar preload anterior de próximo ep (mas manter o principal)
    if (this.nextEpAbortController) {
      this.nextEpAbortController.abort();
    }
    this.nextEpAbortController = new AbortController();
    const { signal } = this.nextEpAbortController;

    console.log(`[BufferPreload] Iniciando preload do próximo episódio...`);

    try {
      const manifestResp = await fetch(nextEpUrl, { signal });
      if (!manifestResp.ok) throw new Error(`Manifest HTTP ${manifestResp.status}`);
      const manifestText = await manifestResp.text();

      const segments = this.parseM3U8Segments(manifestText, nextEpUrl);

      // Pegar apenas os 3 primeiros segmentos (~6-9s)
      const targetSegments = segments.slice(0, 3);

      await this.evictIfNeeded(targetSegments.length * 2_000_000);
      const cache = await caches.open(CACHE_NAME);

      for (const seg of targetSegments) {
        if (signal.aborted) break;

        const cached = await cache.match(seg.url);
        if (cached) continue;

        try {
          const resp = await fetch(seg.url, { signal });
          if (!resp.ok) continue;

          const blob = await resp.blob();

          await cache.put(seg.url, new Response(blob, {
            headers: {
              'Content-Type': 'video/mp2t',
              'X-RedX-ContentId': contentId,
              'X-RedX-Cached': Date.now().toString(),
            },
          }));

          await this.metaDB.put({
            url: seg.url,
            size: blob.size,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
            contentId,
          });
        } catch (err) {
          if (signal.aborted) break;
          console.warn('[BufferPreload] Falha preload next ep segment:', err);
        }
      }

      if (!signal.aborted) {
        console.log(`[BufferPreload] ✓ Próximo episódio pré-carregado (${targetSegments.length} segmentos)`);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[BufferPreload] Erro preload próximo episódio:', err);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // M3U8 PARSER
  // ═══════════════════════════════════════════════════════

  private parseM3U8Segments(manifest: string, baseUrl: string): { url: string; duration: number }[] {
    const segments: { url: string; duration: number }[] = [];
    const lines = manifest.split('\n');
    let currentDuration = 0;

    // Extrair base URL para resolver caminhos relativos
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // #EXTINF:duration,
      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/#EXTINF:([\d.]+)/);
        if (match) {
          currentDuration = parseFloat(match[1]);
        }
        continue;
      }

      // URL do segmento (linha seguinte a #EXTINF)
      if (!line.startsWith('#') && line.length > 0 && currentDuration > 0) {
        const segUrl = line.startsWith('http') ? line : `${base}${line}`;
        segments.push({ url: segUrl, duration: currentDuration });
        currentDuration = 0;
      }

      // Se for um master playlist com variantes, ignorar — o HLS.js gerencia
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        return []; // É um master manifest, não um media manifest
      }
    }

    return segments;
  }

  // ═══════════════════════════════════════════════════════
  // LRU EVICTION
  // ═══════════════════════════════════════════════════════

  /**
   * Libera espaço no cache usando estratégia LRU.
   * Remove os segmentos menos recentemente acessados até
   * ter pelo menos `neededBytes` de espaço livre.
   */
  private async evictIfNeeded(neededBytes: number): Promise<void> {
    try {
      const totalSize = await this.metaDB.getTotalSize();

      if (totalSize + neededBytes <= MAX_CACHE_SIZE_BYTES) return;

      const bytesToFree = (totalSize + neededBytes) - MAX_CACHE_SIZE_BYTES;
      console.log(`[BufferPreload] LRU eviction: liberando ${formatBytes(bytesToFree)}`);

      const cache = await caches.open(CACHE_NAME);
      const lruItems = await this.metaDB.getLRU(50); // Pegar até 50 candidatos

      let freed = 0;
      for (const item of lruItems) {
        if (freed >= bytesToFree) break;

        await cache.delete(item.url);
        await this.metaDB.delete(item.url);
        freed += item.size;

        console.log(`[BufferPreload] Evicted: ${item.url.substring(item.url.lastIndexOf('/') + 1)} (${formatBytes(item.size)})`);
      }

      console.log(`[BufferPreload] LRU eviction completa: ${formatBytes(freed)} liberados`);
    } catch (err) {
      console.warn('[BufferPreload] Erro LRU eviction:', err);
    }
  }

  // ═══════════════════════════════════════════════════════
  // CACHE INFO
  // ═══════════════════════════════════════════════════════

  /**
   * Retorna informações sobre o cache atual.
   */
  async getCacheInfo(): Promise<{
    totalSize: number;
    segmentCount: number;
    maxSize: number;
    usagePercent: number;
  }> {
    try {
      const all = await this.metaDB.getAll();
      const totalSize = all.reduce((sum, item) => sum + item.size, 0);
      return {
        totalSize,
        segmentCount: all.length,
        maxSize: MAX_CACHE_SIZE_BYTES,
        usagePercent: Math.round((totalSize / MAX_CACHE_SIZE_BYTES) * 100),
      };
    } catch {
      return { totalSize: 0, segmentCount: 0, maxSize: MAX_CACHE_SIZE_BYTES, usagePercent: 0 };
    }
  }

  /**
   * Limpa todo o cache (segmentos + metadata).
   */
  async clearAllCache(): Promise<void> {
    try {
      await caches.delete(CACHE_NAME);
      const db = await this.metaDB.open();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      console.log('[BufferPreload] ✓ Cache completamente limpo');
    } catch (err) {
      console.error('[BufferPreload] Erro ao limpar cache:', err);
    }
  }

  /**
   * Remove cache de um conteúdo específico.
   */
  async clearContentCache(contentId: string): Promise<void> {
    try {
      const items = await this.metaDB.getByContentId(contentId);
      const cache = await caches.open(CACHE_NAME);

      for (const item of items) {
        await cache.delete(item.url);
        await this.metaDB.delete(item.url);
      }

      console.log(`[BufferPreload] Cache do conteúdo "${contentId}" limpo (${items.length} segmentos)`);
    } catch (err) {
      console.warn('[BufferPreload] Erro ao limpar cache do conteúdo:', err);
    }
  }

  // ═══════════════════════════════════════════════════════
  // CONTROLE
  // ═══════════════════════════════════════════════════════

  cancelPreload(): void {
    if (this.preloadAbortController) {
      this.preloadAbortController.abort();
      this.preloadAbortController = null;
    }
  }

  cancelNextEpisodePreload(): void {
    if (this.nextEpAbortController) {
      this.nextEpAbortController.abort();
      this.nextEpAbortController = null;
    }
  }

  cancelAll(): void {
    this.cancelPreload();
    this.cancelNextEpisodePreload();
  }

  getStatus(): PreloadStatus {
    return { ...this.currentStatus };
  }

  destroy(): void {
    this.cancelAll();
    this.metaDB.close();
    this.currentStatus = { state: 'idle', loadedSegments: 0, totalSegments: 0, loadedBytes: 0 };
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════

  private updateStatus(status: PreloadStatus, callback?: PreloadCallback): void {
    this.currentStatus = { ...status };
    callback?.(this.currentStatus);
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ═══════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════

let _preloadInstance: BufferPreloadManager | null = null;

export function getBufferPreloadManager(): BufferPreloadManager {
  if (!_preloadInstance) {
    _preloadInstance = new BufferPreloadManager();
  }
  return _preloadInstance;
}

export function destroyBufferPreloadManager(): void {
  if (_preloadInstance) {
    _preloadInstance.destroy();
    _preloadInstance = null;
  }
}

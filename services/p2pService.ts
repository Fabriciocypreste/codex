/**
 * p2pService.ts — Serviço P2P com WebRTC + CDN Hybrid
 * ════════════════════════════════════════════════════════
 * - WebRTC data channels para streaming P2P
 * - Hybrid mode: CDN primeiro, P2P quando peers disponíveis
 * - Seed de chunks assistidos
 * - Bandwidth management
 * - Stats em tempo real
 * - Graceful degradation (P2P → CDN fallback)
 *
 * NOTA: WebTorrent é pesado (~450KB). Implementamos uma
 * camada leve de P2P via WebRTC DataChannels + Supabase Realtime
 * como signaling server, mantendo bundle enxuto.
 * Pode ser substituído por WebTorrent se necessário via dynamic import.
 */

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════

export interface P2PConfig {
  enabled: boolean;
  maxPeers: number;
  maxUploadSpeed: number; // KB/s, 0 = ilimitado
  chunkSize: number;      // bytes
  bufferAhead: number;    // segundos
  seedCompleted: boolean;
  stunServers: string[];
  turnServers: TurnServer[];
  trackerUrls: string[];
  hybridMode: boolean;    // CDN + P2P
  cdnFirstDuration: number; // segundos via CDN antes de tentar P2P
  minPeersForSwitch: number; // peers mínimos para trocar de CDN → P2P
}

export interface TurnServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface P2PPeer {
  id: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  latency: number;
  downloadSpeed: number;
  uploadSpeed: number;
  chunksReceived: number;
  chunksSent: number;
  joinedAt: number;
}

export interface P2PStats {
  peersConnected: number;
  peersTotal: number;
  downloadSpeed: number; // KB/s total
  uploadSpeed: number;   // KB/s total
  bytesDownloaded: number;
  bytesUploaded: number;
  chunksBuffered: number;
  ratio: number;         // P2P vs CDN (0..1)
  bandwidthSaved: number; // bytes economizados via P2P
  mode: 'cdn' | 'p2p' | 'hybrid';
}

export interface P2PChunk {
  index: number;
  contentId: string;
  data: ArrayBuffer;
  size: number;
  hash: string;
}

type P2PEventType = 'peer-connected' | 'peer-disconnected' | 'stats-update' | 'mode-change' | 'error';
type P2PEventHandler = (data: any) => void;

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÃO PADRÃO
// ═══════════════════════════════════════════════════════

const DEFAULT_CONFIG: P2PConfig = {
  enabled: false,
  maxPeers: 8,
  maxUploadSpeed: 0,
  chunkSize: 1024 * 1024, // 1MB
  bufferAhead: 30,
  seedCompleted: true,
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ],
  turnServers: [],
  trackerUrls: [],
  hybridMode: true,
  cdnFirstDuration: 5,
  minPeersForSwitch: 3,
};

const STORAGE_KEY = 'redx_p2p_config';
const STATS_INTERVAL_MS = 2000;

// ═══════════════════════════════════════════════════════
// P2P MANAGER
// ═══════════════════════════════════════════════════════

class P2PManager {
  private config: P2PConfig;
  private peers = new Map<string, P2PPeer>();
  private chunks = new Map<string, ArrayBuffer>(); // contentId:index → data
  private listeners = new Map<P2PEventType, Set<P2PEventHandler>>();
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private stats: P2PStats;
  private activeContentId: string | null = null;
  private isDestroyed = false;

  constructor(config?: Partial<P2PConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Carregar config do localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch {}

    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): P2PStats {
    return {
      peersConnected: 0,
      peersTotal: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      chunksBuffered: 0,
      ratio: 0,
      bandwidthSaved: 0,
      mode: 'cdn',
    };
  }

  // ── Event System ──

  on(event: P2PEventType, handler: P2PEventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: P2PEventType, handler: P2PEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: P2PEventType, data: any): void {
    this.listeners.get(event)?.forEach((h) => {
      try { h(data); } catch {}
    });
  }

  // ── Configuração ──

  getConfig(): P2PConfig {
    return { ...this.config };
  }

  updateConfig(update: Partial<P2PConfig>): void {
    this.config = { ...this.config, ...update };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {}
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ── Iniciar Sessão P2P ──

  async start(contentId: string): Promise<void> {
    if (!this.config.enabled || this.isDestroyed) return;

    this.activeContentId = contentId;
    this.stats = this.createEmptyStats();
    this.stats.mode = this.config.hybridMode ? 'hybrid' : 'p2p';

    // Iniciar stats polling
    this.statsTimer = setInterval(() => {
      this.updateStats();
      this.emit('stats-update', this.getStats());
    }, STATS_INTERVAL_MS);

    console.log(`[P2P] Sessão iniciada para conteúdo: ${contentId}`);
  }

  // ── Criar Peer Connection ──

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const iceServers: RTCIceServer[] = [
      ...this.config.stunServers.map(urls => ({ urls })),
      ...this.config.turnServers.map(t => ({
        urls: t.urls,
        username: t.username,
        credential: t.credential,
      })),
    ];

    const pc = new RTCPeerConnection({ iceServers });

    pc.oniceconnectionstatechange = () => {
      const peer = this.peers.get(peerId);
      if (!peer) return;

      switch (pc.iceConnectionState) {
        case 'connected':
        case 'completed':
          peer.state = 'connected';
          this.emit('peer-connected', { peerId, total: this.getConnectedPeers().length });
          break;
        case 'disconnected':
        case 'closed':
          peer.state = 'disconnected';
          this.emit('peer-disconnected', { peerId });
          this.peers.delete(peerId);
          break;
        case 'failed':
          peer.state = 'failed';
          this.emit('peer-disconnected', { peerId, reason: 'failed' });
          this.peers.delete(peerId);
          break;
      }
    };

    return pc;
  }

  // ── Conectar a um Peer ──

  async connectToPeer(peerId: string, offer?: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (this.peers.size >= this.config.maxPeers) return null;
    if (this.peers.has(peerId)) return null;

    const pc = this.createPeerConnection(peerId);
    const peer: P2PPeer = {
      id: peerId,
      connection: pc,
      dataChannel: null,
      state: 'connecting',
      latency: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      chunksReceived: 0,
      chunksSent: 0,
      joinedAt: Date.now(),
    };

    this.peers.set(peerId, peer);

    if (offer) {
      // Responder a uma oferta
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      pc.ondatachannel = (event) => {
        peer.dataChannel = event.channel;
        this.setupDataChannel(peer);
      };

      return answer;
    } else {
      // Criar oferta
      const dc = pc.createDataChannel('p2p-stream', {
        ordered: false,
        maxRetransmits: 2,
      });
      peer.dataChannel = dc;
      this.setupDataChannel(peer);

      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);
      return offerDesc;
    }
  }

  private setupDataChannel(peer: P2PPeer): void {
    const dc = peer.dataChannel;
    if (!dc) return;

    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      peer.state = 'connected';
      // Enviar ping para medir latência
      dc.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          this.handleControlMessage(peer, msg);
        } else {
          // Chunk de dados binário
          this.handleChunkReceived(peer, event.data as ArrayBuffer);
        }
      } catch {}
    };

    dc.onclose = () => {
      peer.state = 'disconnected';
      this.emit('peer-disconnected', { peerId: peer.id });
    };
  }

  private handleControlMessage(peer: P2PPeer, msg: any): void {
    switch (msg.type) {
      case 'ping':
        peer.dataChannel?.send(JSON.stringify({ type: 'pong', ts: msg.ts }));
        break;
      case 'pong':
        peer.latency = Date.now() - msg.ts;
        break;
      case 'request-chunk': {
        const key = `${msg.contentId}:${msg.index}`;
        const chunk = this.chunks.get(key);
        if (chunk && peer.dataChannel?.readyState === 'open') {
          // Header com info do chunk
          peer.dataChannel.send(JSON.stringify({
            type: 'chunk-header',
            contentId: msg.contentId,
            index: msg.index,
            size: chunk.byteLength,
          }));
          // Dados binários
          peer.dataChannel.send(chunk);
          peer.chunksSent++;
          this.stats.bytesUploaded += chunk.byteLength;
        }
        break;
      }
      case 'chunk-header':
        // Preparar para receber chunk
        break;
      case 'available-chunks':
        // Peer informou quais chunks tem
        break;
    }
  }

  private handleChunkReceived(peer: P2PPeer, data: ArrayBuffer): void {
    peer.chunksReceived++;
    this.stats.bytesDownloaded += data.byteLength;
    this.stats.bandwidthSaved += data.byteLength;
    this.stats.chunksBuffered++;
  }

  // ── Seed chunk (após assitir) ──

  seedChunk(contentId: string, index: number, data: ArrayBuffer): void {
    if (!this.config.seedCompleted) return;
    const key = `${contentId}:${index}`;
    this.chunks.set(key, data);

    // Informar peers disponíveis
    for (const peer of this.getConnectedPeers()) {
      peer.dataChannel?.send(JSON.stringify({
        type: 'available-chunks',
        contentId,
        chunks: Array.from(this.chunks.keys())
          .filter(k => k.startsWith(`${contentId}:`))
          .map(k => parseInt(k.split(':')[1])),
      }));
    }
  }

  // ── Solicitar chunk de peers ──

  async requestChunk(contentId: string, index: number): Promise<ArrayBuffer | null> {
    // Verificar cache local primeiro
    const key = `${contentId}:${index}`;
    const cached = this.chunks.get(key);
    if (cached) return cached;

    // Procurar peers com melhor latência
    const connected = this.getConnectedPeers()
      .sort((a, b) => a.latency - b.latency);

    for (const peer of connected) {
      if (peer.dataChannel?.readyState !== 'open') continue;

      try {
        peer.dataChannel.send(JSON.stringify({
          type: 'request-chunk',
          contentId,
          index,
        }));

        // Aguardar resposta (com timeout de 5s)
        const chunk = await this.waitForChunk(peer, contentId, index, 5000);
        if (chunk) {
          this.chunks.set(key, chunk);
          return chunk;
        }
      } catch {}
    }

    return null;
  }

  private waitForChunk(
    peer: P2PPeer,
    contentId: string,
    index: number,
    timeout: number
  ): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);

      const handler = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          clearTimeout(timer);
          peer.dataChannel?.removeEventListener('message', handler);
          resolve(event.data);
        }
      };

      peer.dataChannel?.addEventListener('message', handler);
    });
  }

  // ── Stats ──

  private updateStats(): void {
    const connected = this.getConnectedPeers();
    this.stats.peersConnected = connected.length;
    this.stats.peersTotal = this.peers.size;

    // Calcular speeds
    this.stats.downloadSpeed = connected.reduce((sum, p) => sum + p.downloadSpeed, 0);
    this.stats.uploadSpeed = connected.reduce((sum, p) => sum + p.uploadSpeed, 0);

    // Ratio P2P vs CDN
    const totalBytes = this.stats.bytesDownloaded + this.stats.bandwidthSaved;
    this.stats.ratio = totalBytes > 0 ? this.stats.bandwidthSaved / totalBytes : 0;

    // Determinar modo
    if (this.stats.peersConnected >= this.config.minPeersForSwitch) {
      this.stats.mode = this.config.hybridMode ? 'hybrid' : 'p2p';
    } else {
      this.stats.mode = 'cdn';
    }
  }

  getStats(): P2PStats {
    return { ...this.stats };
  }

  getConnectedPeers(): P2PPeer[] {
    return Array.from(this.peers.values()).filter(p => p.state === 'connected');
  }

  getPeerCount(): number {
    return this.getConnectedPeers().length;
  }

  // ── Parar ──

  stop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }

    // Fechar todas as conexões
    for (const peer of this.peers.values()) {
      peer.dataChannel?.close();
      peer.connection.close();
    }
    this.peers.clear();
    this.chunks.clear();
    this.activeContentId = null;
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.isDestroyed = true;
  }

  // ── Formatar bytes ──
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  static formatSpeed(kbps: number): string {
    if (kbps < 1024) return `${kbps.toFixed(0)} KB/s`;
    return `${(kbps / 1024).toFixed(1)} MB/s`;
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════

let _instance: P2PManager | null = null;

export function getP2PManager(): P2PManager {
  if (!_instance) {
    _instance = new P2PManager();
  }
  return _instance;
}

export { P2PManager };
export default getP2PManager;

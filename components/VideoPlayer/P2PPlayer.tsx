import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getP2PManager, P2PStats, P2PManager } from '../../services/p2pService';
import { Wifi, WifiOff, Users, ArrowUpCircle, ArrowDownCircle, Zap, Server, Radio } from 'lucide-react';

/**
 * P2PPlayer — Componente de overlay P2P para o Player
 * ════════════════════════════════════════════════════════
 * Estratégia híbrida:
 *  1. Iniciar via CDN (primeiros 5s)
 *  2. Conectar peers em background
 *  3. Trocar para P2P quando disponível (>3 peers)
 *  4. Fallback para CDN se P2P falhar
 *  5. Priorizar peers com melhor latência
 *
 * Este componente é um OVERLAY que se integra ao Player existente.
 * Não substitui o player — adiciona funcionalidade P2P.
 */

interface P2PPlayerProps {
  /** ID do conteúdo sendo reproduzido */
  contentId: string;
  /** URL do stream atual (CDN) */
  streamUrl: string;
  /** Se controles estão visíveis */
  controlsVisible?: boolean;
  /** Compacto (apenas badge) vs expandido (stats) */
  compact?: boolean;
}

const P2PPlayer: React.FC<P2PPlayerProps> = ({
  contentId,
  streamUrl,
  controlsVisible = true,
  compact = true,
}) => {
  const [stats, setStats] = useState<P2PStats | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const managerRef = useRef<P2PManager | null>(null);

  // ── Inicializar P2P ──
  useEffect(() => {
    const manager = getP2PManager();
    managerRef.current = manager;
    setIsEnabled(manager.isEnabled());

    if (!manager.isEnabled()) return;

    // Iniciar sessão P2P
    manager.start(contentId).catch(() => {});

    // Escutar stats
    const handleStats = (newStats: P2PStats) => {
      setStats(newStats);
    };

    manager.on('stats-update', handleStats);

    return () => {
      manager.off('stats-update', handleStats);
      manager.stop();
    };
  }, [contentId]);

  // ── Toggle detalhes ──
  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  // Se P2P desabilitado, não renderizar
  if (!isEnabled) return null;

  const mode = stats?.mode || 'cdn';
  const modeColor = mode === 'p2p' ? '#22c55e' : mode === 'hybrid' ? '#3b82f6' : '#6b7280';
  const modeLabel = mode === 'p2p' ? 'P2P' : mode === 'hybrid' ? 'Híbrido' : 'CDN';

  return (
    <div
      className={`absolute top-20 left-8 z-30 transition-all duration-500 ${
        controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Badge Compacto */}
      <button
        onClick={toggleDetails}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); toggleDetails(); } }}
        tabIndex={0}
        className="flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10 hover:bg-black/80 transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]"
        title="Detalhes P2P"
      >
        <Radio className="w-3.5 h-3.5" style={{ color: modeColor }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: modeColor }}>
          {modeLabel}
        </span>
        {stats && stats.peersConnected > 0 && (
          <>
            <span className="text-white/20 text-[10px]">|</span>
            <Users className="w-3 h-3 text-white/40" />
            <span className="text-[10px] text-white/50 font-mono">{stats.peersConnected}</span>
          </>
        )}
      </button>

      {/* Painel de Detalhes */}
      {showDetails && stats && (
        <div className="mt-2 bg-black/90 backdrop-blur-2xl rounded-2xl p-4 border border-white/10 min-w-[260px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/30 text-[9px] uppercase tracking-[0.3em] font-bold">P2P Status</p>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: modeColor }}
            />
          </div>

          {/* Modo atual */}
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-white/5">
            <Server className="w-4 h-4" style={{ color: modeColor }} />
            <span className="text-sm font-bold" style={{ color: modeColor }}>{modeLabel}</span>
            <span className="text-[10px] text-white/30 ml-auto">
              {stats.ratio > 0 ? `${(stats.ratio * 100).toFixed(0)}% P2P` : 'CDN puro'}
            </span>
          </div>

          {/* Peers */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-400/60" />
                <span className="text-[9px] text-white/30 uppercase tracking-wider">Peers</span>
              </div>
              <p className="text-lg font-black text-white">
                {stats.peersConnected}<span className="text-white/20 text-sm">/{stats.peersTotal}</span>
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-green-400/60" />
                <span className="text-[9px] text-white/30 uppercase tracking-wider">Chunks</span>
              </div>
              <p className="text-lg font-black text-white">{stats.chunksBuffered}</p>
            </div>
          </div>

          {/* Velocidades */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowDownCircle className="w-3.5 h-3.5 text-green-400/60" />
                <span className="text-[10px] text-white/40">Download</span>
              </div>
              <span className="text-[10px] text-white/60 font-mono">
                {P2PManager.formatSpeed(stats.downloadSpeed)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpCircle className="w-3.5 h-3.5 text-blue-400/60" />
                <span className="text-[10px] text-white/40">Upload</span>
              </div>
              <span className="text-[10px] text-white/60 font-mono">
                {P2PManager.formatSpeed(stats.uploadSpeed)}
              </span>
            </div>
          </div>

          {/* Bandwidth Economizado */}
          {stats.bandwidthSaved > 0 && (
            <div className="bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
              <p className="text-[10px] text-green-400/80 flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                Economizado: <strong>{P2PManager.formatBytes(stats.bandwidthSaved)}</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(P2PPlayer);

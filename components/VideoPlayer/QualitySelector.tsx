import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Check, Signal, Wifi, ChevronUp, Zap } from 'lucide-react';
import { QualityLevel, StreamStats, HlsStreamingManager } from '../../services/hlsStreamingService';

/**
 * QualitySelector — Seletor de qualidade HLS para TV Box
 * ══════════════════════════════════════════════════════════
 * - Dropdown com animação de transição
 * - Badge mostrando qualidade atual
 * - Auto (ABR) como padrão
 * - Feedback visual ao trocar (ripple + toast)
 * - Preferência persistida em localStorage
 */

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const STORAGE_KEY = 'redx_quality_preference';
const QUALITY_TRANSITION_MS = 600;

interface QualityPreference {
  mode: 'auto' | 'manual';
  /** -1 = auto, >= 0 = height preferido */
  preferredHeight: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function loadPreference(): QualityPreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QualityPreference;
  } catch {
    return null;
  }
}

function savePreference(pref: QualityPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Storage cheio ou indisponível
  }
}

function getQualityColor(height: number): string {
  if (height >= 2160) return '#a855f7'; // Purple — 4K
  if (height >= 1440) return '#3b82f6'; // Blue — 2K
  if (height >= 1080) return '#22c55e'; // Green — FHD
  if (height >= 720) return '#eab308';  // Yellow — HD
  if (height >= 480) return '#f97316';  // Orange — SD
  return '#ef4444';                     // Red — Low
}

function getQualityIcon(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return 'FHD';
  if (height >= 720) return 'HD';
  if (height >= 480) return 'SD';
  return 'LD';
}

// ═══════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════

interface QualitySelectorProps {
  qualityLevels: QualityLevel[];
  currentQuality: QualityLevel | null;
  isAutoQuality: boolean;
  streamStats: StreamStats | null;
  hlsManager: HlsStreamingManager | null;
  onQualityChange?: (level: QualityLevel | null, isAuto: boolean) => void;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({
  qualityLevels,
  currentQuality,
  isAutoQuality,
  streamStats,
  hlsManager,
  onQualityChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const [hasAppliedPref, setHasAppliedPref] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Aplicar preferência salva quando os níveis ficam disponíveis ──
  useEffect(() => {
    if (hasAppliedPref || qualityLevels.length === 0 || !hlsManager) return;

    const pref = loadPreference();
    if (!pref) {
      setHasAppliedPref(true);
      return;
    }

    if (pref.mode === 'auto') {
      hlsManager.setAutoQuality();
      onQualityChange?.(null, true);
    } else if (pref.preferredHeight > 0) {
      // Encontrar nível mais próximo da preferência
      const match = qualityLevels.find(q => q.height === pref.preferredHeight);
      if (match) {
        hlsManager.setQualityLevel(match.index);
        onQualityChange?.(match, false);
      } else {
        // Preferência não disponível neste stream, usar auto
        hlsManager.setAutoQuality();
        onQualityChange?.(null, true);
      }
    }

    setHasAppliedPref(true);
    console.log(`[QualitySelector] Preferência restaurada: ${pref.mode}${pref.preferredHeight > 0 ? ` (${pref.preferredHeight}p)` : ''}`);
  }, [qualityLevels, hlsManager, hasAppliedPref, onQualityChange]);

  // ── Fechar menu ao clicar fora ──
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // ── Cleanup timers ──
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  // ── Mostrar feedback temporário ──
  const showFeedback = useCallback((label: string) => {
    setFeedbackLabel(label);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedbackLabel(null), 2500);
  }, []);

  // ── Selecionar qualidade ──
  const selectAuto = useCallback(() => {
    if (!hlsManager) return;

    setTransitioning(true);
    hlsManager.setAutoQuality();

    savePreference({ mode: 'auto', preferredHeight: -1, updatedAt: Date.now() });
    onQualityChange?.(null, true);
    showFeedback('Automático (ABR)');

    setTimeout(() => setTransitioning(false), QUALITY_TRANSITION_MS);
    setIsOpen(false);
  }, [hlsManager, onQualityChange, showFeedback]);

  const selectLevel = useCallback((level: QualityLevel) => {
    if (!hlsManager) return;

    setTransitioning(true);
    hlsManager.setQualityLevel(level.index);

    savePreference({ mode: 'manual', preferredHeight: level.height, updatedAt: Date.now() });
    onQualityChange?.(level, false);
    showFeedback(level.label);

    setTimeout(() => setTransitioning(false), QUALITY_TRANSITION_MS);
    setIsOpen(false);
  }, [hlsManager, onQualityChange, showFeedback]);

  // ── Atalho teclado ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setIsOpen(false);
    }
  }, []);

  // Se não há níveis, não renderizar
  if (qualityLevels.length === 0) return null;

  const badgeColor = currentQuality ? getQualityColor(currentQuality.height) : '#6b7280';
  const badgeIcon = currentQuality ? getQualityIcon(currentQuality.height) : 'Auto';

  return (
    <div className="relative" ref={menuRef} onKeyDown={handleKeyDown}>
      {/* ═══ TRIGGER BUTTON ═══ */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
        tabIndex={0}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#E50914] ${
          isOpen ? 'bg-white/10 text-white' : 'text-white/40 hover:text-red-500'
        } ${transitioning ? 'animate-pulse' : ''}`}
        title="Qualidade (Q)"
        aria-label="Seletor de qualidade"
        aria-expanded={isOpen}
      >
        <Settings className={`w-5 h-5 transition-transform duration-500 ${isOpen ? 'rotate-90' : ''}`} />

        {/* Badge de qualidade atual */}
        <span
          className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded hidden md:inline-block transition-all duration-300"
          style={{
            backgroundColor: `${badgeColor}20`,
            color: badgeColor,
            border: `1px solid ${badgeColor}40`,
          }}
        >
          {isAutoQuality ? 'Auto' : badgeIcon}
        </span>
      </button>

      {/* ═══ FEEDBACK TOAST ═══ */}
      {feedbackLabel && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 pointer-events-none">
          <div className="bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-xl px-3 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <p className="text-[10px] text-green-400 font-bold flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              {feedbackLabel}
            </p>
          </div>
        </div>
      )}

      {/* ═══ DROPDOWN MENU ═══ */}
      {isOpen && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 min-w-[220px] shadow-2xl z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-white/30 text-[9px] uppercase tracking-[0.3em] font-bold">Qualidade</p>
            <ChevronUp className="w-3 h-3 text-white/20" />
          </div>

          {/* ── Auto (ABR) ── */}
          <button
            onClick={selectAuto}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selectAuto(); } }}
            tabIndex={0}
            data-nav-item
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E50914] group ${
              isAutoQuality
                ? 'bg-red-600/20 text-red-400 font-bold'
                : 'text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Signal className="w-4 h-4" />
              <span>Automático</span>
              {streamStats && (
                <span className="text-[8px] text-white/25 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                  {streamStats.networkSpeed.toFixed(1)} Mbps
                </span>
              )}
            </span>
            {isAutoQuality && <Check className="w-4 h-4 text-red-500" />}
          </button>

          <div className="h-px bg-white/5 my-1" />

          {/* ── Níveis manuais ── */}
          {qualityLevels.map((level, i) => {
            const isActive = !isAutoQuality && currentQuality?.index === level.index;
            const color = getQualityColor(level.height);
            const tag = getQualityIcon(level.height);

            return (
              <button
                key={level.index}
                onClick={() => selectLevel(level)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selectLevel(level); } }}
                tabIndex={0}
                data-nav-item
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E50914] ${
                  isActive
                    ? 'bg-red-600/20 text-red-400 font-bold'
                    : 'text-white/70 hover:bg-white/10'
                }`}
                style={{
                  // Animação staggered de entrada
                  animationDelay: `${(i + 1) * 30}ms`,
                }}
              >
                <span className="flex items-center gap-2.5">
                  {/* Dot indicador de qualidade */}
                  <span
                    className="w-2 h-2 rounded-full transition-transform duration-200 group-hover:scale-125"
                    style={{ backgroundColor: color }}
                  />
                  <span>{level.label}</span>
                  <span
                    className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}15`,
                      color: `${color}cc`,
                    }}
                  >
                    {tag}
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  {/* Bitrate */}
                  <span className="text-[8px] text-white/20 font-mono hidden md:inline">
                    {level.bitrate >= 1_000_000
                      ? `${(level.bitrate / 1_000_000).toFixed(1)}M`
                      : `${(level.bitrate / 1_000).toFixed(0)}K`}
                  </span>
                  {isActive && <Check className="w-4 h-4 text-red-500" />}
                </span>
              </button>
            );
          })}

          {/* ── Rodapé com info de rede ── */}
          {streamStats && (
            <>
              <div className="h-px bg-white/5 my-1" />
              <div className="px-3 py-1.5 flex items-center gap-2 text-[8px] text-white/20 font-mono">
                <Wifi className="w-3 h-3" />
                <span>{streamStats.networkSpeed.toFixed(1)} Mbps</span>
                <span>·</span>
                <span>Buffer {streamStats.bufferLength}s</span>
                {streamStats.recoveredErrors > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-yellow-500/50">{streamStats.recoveredErrors} recuperados</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(QualitySelector);

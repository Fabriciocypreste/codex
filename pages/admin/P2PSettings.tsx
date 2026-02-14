import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getP2PManager, P2PConfig, P2PStats, TurnServer, P2PManager } from '../../services/p2pService';
import {
  Radio, Server, Users, Wifi, WifiOff, Plus, Trash2, Save,
  ToggleLeft, ToggleRight, ArrowDownCircle, ArrowUpCircle,
  Zap, Shield, Settings, Activity, BarChart3, RefreshCw,
} from 'lucide-react';

/**
 * P2PSettings — Painel Administrativo de Configuração P2P
 * ════════════════════════════════════════════════════════
 * - Enable/disable P2P globalmente
 * - Gerenciar tracker servers
 * - Configurar STUN/TURN servers
 * - Limites de upload/peers
 * - Dashboard de estatísticas
 * - Gráficos de tráfego
 */

const P2PSettings: React.FC = () => {
  const [config, setConfig] = useState<P2PConfig>(getP2PManager().getConfig());
  const [stats, setStats] = useState<P2PStats | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'servers'>('config');
  const [newTracker, setNewTracker] = useState('');
  const [newStun, setNewStun] = useState('');
  const [newTurn, setNewTurn] = useState<TurnServer>({ urls: '', username: '', credential: '' });
  const [saved, setSaved] = useState(false);
  const [statsHistory, setStatsHistory] = useState<P2PStats[]>([]);

  // ── Carregar stats ──
  useEffect(() => {
    const manager = getP2PManager();
    const handler = (newStats: P2PStats) => {
      setStats(newStats);
      setStatsHistory(prev => [...prev.slice(-30), newStats]);
    };
    manager.on('stats-update', handler);
    return () => manager.off('stats-update', handler);
  }, []);

  // ── Salvar config ──
  const handleSave = useCallback(() => {
    const manager = getP2PManager();
    manager.updateConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config]);

  // ── Atualizar campo ──
  const updateField = useCallback(<K extends keyof P2PConfig>(key: K, value: P2PConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Adicionar tracker ──
  const addTracker = useCallback(() => {
    if (!newTracker.trim()) return;
    setConfig(prev => ({
      ...prev,
      trackerUrls: [...prev.trackerUrls, newTracker.trim()],
    }));
    setNewTracker('');
  }, [newTracker]);

  // ── Remover tracker ──
  const removeTracker = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      trackerUrls: prev.trackerUrls.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Adicionar STUN ──
  const addStun = useCallback(() => {
    if (!newStun.trim()) return;
    setConfig(prev => ({
      ...prev,
      stunServers: [...prev.stunServers, newStun.trim()],
    }));
    setNewStun('');
  }, [newStun]);

  const removeStun = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      stunServers: prev.stunServers.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Adicionar TURN ──
  const addTurn = useCallback(() => {
    if (!newTurn.urls.trim()) return;
    setConfig(prev => ({
      ...prev,
      turnServers: [...prev.turnServers, { ...newTurn }],
    }));
    setNewTurn({ urls: '', username: '', credential: '' });
  }, [newTurn]);

  const removeTurn = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      turnServers: prev.turnServers.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Tabs ──
  const tabs = [
    { key: 'config' as const, label: 'Configuração', icon: Settings },
    { key: 'servers' as const, label: 'Servidores', icon: Server },
    { key: 'stats' as const, label: 'Estatísticas', icon: BarChart3 },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Radio className="w-8 h-8 text-red-500" />
            P2P Streaming
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Configuração de streaming peer-to-peer híbrido
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#E50914] ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {saved ? <><Zap className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914] ${
              activeTab === tab.key
                ? 'bg-red-600/20 text-red-400 border border-red-500/20'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Configuração ═══ */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Toggle Global */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">P2P Streaming</h3>
                <p className="text-white/40 text-sm mt-1">
                  Ativar distribuição peer-to-peer de conteúdo
                </p>
              </div>
              <button
                onClick={() => updateField('enabled', !config.enabled)}
                className="focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-lg"
              >
                {config.enabled ? (
                  <ToggleRight className="w-12 h-12 text-green-400" />
                ) : (
                  <ToggleLeft className="w-12 h-12 text-white/20" />
                )}
              </button>
            </div>
          </div>

          {/* Modo Híbrido */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Modo Híbrido (CDN + P2P)</h3>
                <p className="text-white/40 text-sm mt-1">
                  CDN nos primeiros segundos, P2P quando peers disponíveis
                </p>
              </div>
              <button
                onClick={() => updateField('hybridMode', !config.hybridMode)}
                className="focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-lg"
              >
                {config.hybridMode ? (
                  <ToggleRight className="w-10 h-10 text-blue-400" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-white/20" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  CDN primeiro (segundos)
                </label>
                <input
                  type="number"
                  value={config.cdnFirstDuration}
                  onChange={(e) => updateField('cdnFirstDuration', Number(e.target.value))}
                  min={0}
                  max={30}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  Peers mínimos para P2P
                </label>
                <input
                  type="number"
                  value={config.minPeersForSwitch}
                  onChange={(e) => updateField('minPeersForSwitch', Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
            </div>
          </div>

          {/* Limites */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400/60" />
              Limites
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  Max Peers Simultâneos
                </label>
                <input
                  type="number"
                  value={config.maxPeers}
                  onChange={(e) => updateField('maxPeers', Number(e.target.value))}
                  min={1}
                  max={50}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  Max Upload (KB/s, 0=ilimitado)
                </label>
                <input
                  type="number"
                  value={config.maxUploadSpeed}
                  onChange={(e) => updateField('maxUploadSpeed', Number(e.target.value))}
                  min={0}
                  step={100}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  Chunk Size (bytes)
                </label>
                <input
                  type="number"
                  value={config.chunkSize}
                  onChange={(e) => updateField('chunkSize', Number(e.target.value))}
                  min={65536}
                  step={65536}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">
                  Buffer Ahead (segundos)
                </label>
                <input
                  type="number"
                  value={config.bufferAhead}
                  onChange={(e) => updateField('bufferAhead', Number(e.target.value))}
                  min={5}
                  max={120}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Seed chunks assistidos</p>
                <p className="text-xs text-white/30">Compartilhar partes já baixadas com peers</p>
              </div>
              <button
                onClick={() => updateField('seedCompleted', !config.seedCompleted)}
                className="focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-lg"
              >
                {config.seedCompleted ? (
                  <ToggleRight className="w-10 h-10 text-green-400" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-white/20" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Servidores ═══ */}
      {activeTab === 'servers' && (
        <div className="space-y-6">
          {/* Tracker Servers */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400/60" />
              Tracker Servers
            </h3>

            <div className="space-y-2 mb-4">
              {config.trackerUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-white/60 flex-1 font-mono truncate">{url}</span>
                  <button
                    onClick={() => removeTracker(i)}
                    className="text-red-400/60 hover:text-red-400 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {config.trackerUrls.length === 0 && (
                <p className="text-white/20 text-sm text-center py-4">Nenhum tracker configurado</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTracker}
                onChange={(e) => setNewTracker(e.target.value)}
                placeholder="wss://tracker.example.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914] placeholder:text-white/15"
                onKeyDown={(e) => { if (e.key === 'Enter') addTracker(); }}
              />
              <button
                onClick={addTracker}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/60 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* STUN Servers */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-400/60" />
              STUN Servers
            </h3>

            <div className="space-y-2 mb-4">
              {config.stunServers.map((url, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-white/60 flex-1 font-mono truncate">{url}</span>
                  <button
                    onClick={() => removeStun(i)}
                    className="text-red-400/60 hover:text-red-400 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newStun}
                onChange={(e) => setNewStun(e.target.value)}
                placeholder="stun:stun.example.com:3478"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914] placeholder:text-white/15"
                onKeyDown={(e) => { if (e.key === 'Enter') addStun(); }}
              />
              <button
                onClick={addStun}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/60 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* TURN Servers */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-400/60" />
              TURN Servers
            </h3>

            <div className="space-y-2 mb-4">
              {config.turnServers.map((srv, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                  <div className="flex-1">
                    <span className="text-sm text-white/60 font-mono truncate block">{srv.urls}</span>
                    {srv.username && (
                      <span className="text-xs text-white/20">{srv.username}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeTurn(i)}
                    className="text-red-400/60 hover:text-red-400 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {config.turnServers.length === 0 && (
                <p className="text-white/20 text-sm text-center py-4">Nenhum TURN server configurado</p>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={newTurn.urls}
                onChange={(e) => setNewTurn(prev => ({ ...prev, urls: e.target.value }))}
                placeholder="turn:turn.example.com:3478"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914] placeholder:text-white/15"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTurn.username || ''}
                  onChange={(e) => setNewTurn(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Usuário"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914] placeholder:text-white/15"
                />
                <input
                  type="password"
                  value={newTurn.credential || ''}
                  onChange={(e) => setNewTurn(prev => ({ ...prev, credential: e.target.value }))}
                  placeholder="Senha"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914] placeholder:text-white/15"
                />
                <button
                  onClick={addTurn}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/60 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Estatísticas ═══ */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Peers Ativos', value: stats?.peersConnected ?? 0, icon: Users, color: 'blue' },
              { label: 'Bandwidth Salvo', value: P2PManager.formatBytes(stats?.bandwidthSaved ?? 0), icon: Zap, color: 'green' },
              { label: 'Download', value: P2PManager.formatSpeed(stats?.downloadSpeed ?? 0), icon: ArrowDownCircle, color: 'green' },
              { label: 'Upload', value: P2PManager.formatSpeed(stats?.uploadSpeed ?? 0), icon: ArrowUpCircle, color: 'blue' },
            ].map((card, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`w-4 h-4 text-${card.color}-400/60`} />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{card.label}</span>
                </div>
                <p className="text-2xl font-black text-white">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Ratio P2P vs CDN */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Ratio P2P vs CDN</h3>
            <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500/60 to-green-400/40 rounded-full transition-all duration-1000"
                style={{ width: `${(stats?.ratio ?? 0) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white/80">
                  {stats?.ratio ? `${(stats.ratio * 100).toFixed(1)}% P2P` : 'Sem dados'}
                </span>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/30 uppercase tracking-wider">
              <span>CDN</span>
              <span>P2P</span>
            </div>
          </div>

          {/* Dados Transferidos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h4 className="text-sm font-bold text-white/60 mb-2">Total Baixado</h4>
              <p className="text-3xl font-black text-white">
                {P2PManager.formatBytes(stats?.bytesDownloaded ?? 0)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h4 className="text-sm font-bold text-white/60 mb-2">Total Enviado</h4>
              <p className="text-3xl font-black text-white">
                {P2PManager.formatBytes(stats?.bytesUploaded ?? 0)}
              </p>
            </div>
          </div>

          {/* Histórico (mini gráfico de barras simples) */}
          {statsHistory.length > 2 && (
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400/60" />
                Peers ao Longo do Tempo
              </h3>
              <div className="flex items-end gap-1 h-24">
                {statsHistory.slice(-30).map((s, i) => {
                  const maxPeers = Math.max(...statsHistory.map(sh => sh.peersConnected), 1);
                  const height = (s.peersConnected / maxPeers) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-blue-400/40 rounded-t transition-all duration-300"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${s.peersConnected} peers`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-white/20">
                <span>1 min atrás</span>
                <span>Agora</span>
              </div>
            </div>
          )}

          {/* Sem dados */}
          {!stats && (
            <div className="bg-white/5 rounded-2xl p-12 border border-white/10 text-center">
              <WifiOff className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-lg font-bold">Sem dados P2P</p>
              <p className="text-white/15 text-sm mt-2">
                Ative o P2P e reproduza um conteúdo para ver estatísticas
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default P2PSettings;

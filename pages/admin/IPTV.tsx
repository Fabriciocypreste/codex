import React, { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Tv, Upload, RefreshCw, Play, Pause, Trash2, Plus, List, CheckCircle, AlertTriangle } from 'lucide-react';

const sources = [
  { id: 1, name: 'Provedor Principal', url: 'http://iptv-source.com/list.m3u', status: 'Online', channels: 1250, lastUpdate: '10 min atrás' },
  { id: 2, name: 'Canais Esportes', url: 'http://sports-premium.net/get.php', status: 'Online', channels: 45, lastUpdate: '1 hora atrás' },
  { id: 3, name: 'Filmes 24h', url: 'http://movies-vod.com/playlist', status: 'Erro', channels: 0, lastUpdate: 'Falha há 2h' },
];

const channels = [
  { id: 101, name: 'Globo SP', category: 'TV Aberta', source: 'Provedor Principal', status: 'active' },
  { id: 102, name: 'SBT', category: 'TV Aberta', source: 'Provedor Principal', status: 'active' },
  { id: 103, name: 'ESPN Brasil', category: 'Esportes', source: 'Canais Esportes', status: 'active' },
  { id: 104, name: 'Premiere Clubes', category: 'Esportes', source: 'Canais Esportes', status: 'offline' },
  { id: 105, name: 'HBO', category: 'Filmes', source: 'Provedor Principal', status: 'active' },
];

const IPTV: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sources' | 'channels'>('sources');

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">IPTV & Canais</h2>
            <p className="text-white/40 text-sm">Gerencie fontes M3U e organize a grade de canais.</p>
          </div>
          <button className="vision-btn px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2">
            <Plus size={18} /> Nova Fonte M3U
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-white/10 pb-1">
          <button 
            onClick={() => setActiveTab('sources')}
            className={`pb-3 px-4 text-sm font-bold transition-colors relative ${activeTab === 'sources' ? 'text-white' : 'text-white/40 hover:text-white'}`}
          >
            Fontes M3U
            {activeTab === 'sources' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('channels')}
            className={`pb-3 px-4 text-sm font-bold transition-colors relative ${activeTab === 'channels' ? 'text-white' : 'text-white/40 hover:text-white'}`}
          >
            Lista de Canais
            {activeTab === 'channels' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>}
          </button>
        </div>

        {activeTab === 'sources' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source) => (
              <div key={source.id} className="bg-[#121217] border border-white/5 rounded-3xl p-6 group hover:border-white/20 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <List size={24} className="text-white/80" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    source.status === 'Online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {source.status}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-2">{source.name}</h3>
                <p className="text-white/40 text-xs font-mono bg-black/20 p-2 rounded-lg truncate mb-4">{source.url}</p>
                
                <div className="flex justify-between items-center text-sm text-white/60 mb-6">
                  <span>{source.channels} canais</span>
                  <span>{source.lastUpdate}</span>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                    <RefreshCw size={16} /> Sincronizar
                  </button>
                  <button className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            <button className="bg-[#121217] border border-white/5 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-white/40 hover:text-white hover:border-white/20 transition-all group min-h-[250px]">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <span className="font-bold">Importar Lista M3U</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex gap-4">
              <input 
                type="text" 
                placeholder="Buscar canal..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-600/50"
              />
              <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none">
                <option>Todas Categorias</option>
                <option>TV Aberta</option>
                <option>Esportes</option>
                <option>Filmes</option>
              </select>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Fonte</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {channels.map((channel) => (
                  <tr key={channel.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                        <Tv size={16} />
                      </div>
                      {channel.name}
                    </td>
                    <td className="px-6 py-4 text-white/60">{channel.category}</td>
                    <td className="px-6 py-4 text-white/40 text-xs">{channel.source}</td>
                    <td className="px-6 py-4">
                      {channel.status === 'active' ? (
                        <div className="flex items-center gap-2 text-green-500 text-xs font-bold">
                          <CheckCircle size={14} /> ONLINE
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
                          <AlertTriangle size={14} /> OFFLINE
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 hover:text-white text-white/40"><Play size={16} /></button>
                        <button className="p-2 hover:text-red-500 text-white/40"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default IPTV;

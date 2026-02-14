import React, { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Save, Server, Database, Bell, Mail, Monitor, Shield, Zap } from 'lucide-react';
import { supabase } from '../../services/supabaseService';

interface AdminConfig {
  instanceName: string;
  maintenanceMode: boolean;
  cdnCaching: boolean;
  smtpServer: string;
  senderEmail: string;
  systemAlerts: boolean;
}

const DEFAULT_CONFIG: AdminConfig = {
  instanceName: 'RED X Master Node 01',
  maintenanceMode: false,
  cdnCaching: true,
  smtpServer: 'smtp.sendgrid.net',
  senderEmail: 'no-reply@redx.com',
  systemAlerts: true
};

const AdminSettings: React.FC = () => {
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Load config from localStorage
    const saved = localStorage.getItem('redx_admin_config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse admin config', e);
      }
    }
  }, []);

  const handleSave = () => {
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      localStorage.setItem('redx_admin_config', JSON.stringify(config));
      setLoading(false);
      setToast({ message: 'Configurações salvas com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    }, 800);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 relative">
        {toast && (
          <div className={`fixed top-4 right-4 px-6 py-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-right fade-in duration-300 font-bold ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1 text-white">Configurações do Sistema</h2>
            <p className="text-white/40 text-sm">Ajustes globais da plataforma RED X.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className={`vision-btn px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2 ${loading ? 'opacity-50 cursor-wait' : ''}`}
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Server & Performance */}
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-8 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-white">
              <Server size={18} className="text-blue-500" /> Servidor & Performance
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Nome da Instância</label>
                <input
                  type="text"
                  value={config.instanceName}
                  onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div
                onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
              >
                <div>
                  <p className="font-bold text-sm text-white">Modo de Manutenção</p>
                  <p className="text-xs text-white/40 group-hover:text-white/60">Bloquear acesso de usuários</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${config.maintenanceMode ? 'bg-red-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${config.maintenanceMode ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>

              <div
                onClick={() => setConfig({ ...config, cdnCaching: !config.cdnCaching })}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
              >
                <div>
                  <p className="font-bold text-sm text-white">Cache CDN</p>
                  <p className="text-xs text-white/40 group-hover:text-white/60">Cloudflare Edge Caching</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${config.cdnCaching ? 'bg-green-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${config.cdnCaching ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications & Email */}
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-8 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-white">
              <Mail size={18} className="text-yellow-500" /> Notificações & Email
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">SMTP Server</label>
                <input
                  type="text"
                  value={config.smtpServer}
                  onChange={(e) => setConfig({ ...config, smtpServer: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email Remetente</label>
                <input
                  type="text"
                  value={config.senderEmail}
                  onChange={(e) => setConfig({ ...config, senderEmail: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                />
              </div>

              <div
                onClick={() => setConfig({ ...config, systemAlerts: !config.systemAlerts })}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
              >
                <div>
                  <p className="font-bold text-sm text-white">Alertas de Sistema</p>
                  <p className="text-xs text-white/40 group-hover:text-white/60">Notificar admins por email</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${config.systemAlerts ? 'bg-green-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${config.systemAlerts ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </div>

          {/* System Health (Read Only) */}
          <div className="md:col-span-2 bg-[#121217] border border-white/5 rounded-3xl p-8 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-white">
              <Shield size={18} className="text-red-500" /> Status do Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/40">DATABASE</span>
                </div>
                <p className="text-xl font-bold text-white">Conectado</p>
                <p className="text-xs text-white/30 mt-1">Supabase PostgreSQL 15</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/40">STORAGE</span>
                </div>
                <p className="text-xl font-bold text-white">Operacional</p>
                <p className="text-xs text-white/30 mt-1">S3 Compatible / Edge</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/40">API LATENCY</span>
                </div>
                <p className="text-xl font-bold text-white">24ms</p>
                <p className="text-xs text-white/30 mt-1">Global Edge Network</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;

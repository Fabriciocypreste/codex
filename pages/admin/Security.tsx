import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { ShieldAlert, Lock, Activity, Globe, AlertTriangle } from 'lucide-react';

const logs = [
  { id: 1, action: 'LOGIN_SUCCESS', user: 'admin@redx.com', ip: '192.168.1.10', time: '14:30:25', status: 'success' },
  { id: 2, action: 'DELETE_USER', user: 'admin@redx.com', ip: '192.168.1.10', time: '12:15:00', status: 'warning' },
  { id: 3, action: 'LOGIN_FAILED', user: 'unknown@hacker.com', ip: '45.23.12.99', time: '03:45:12', status: 'danger' },
  { id: 4, action: 'UPDATE_PLAN', user: 'support@redx.com', ip: '10.0.0.5', time: 'Yesterday', status: 'success' },
];

const blacklist = [
  { id: 1, ip: '45.23.12.99', reason: 'Tentativas de login excessivas', date: '11/02/2026', expires: 'Permanente' },
  { id: 2, ip: '185.200.10.5', reason: 'Proxy detectado', date: '10/02/2026', expires: '30 dias' },
];

const Security: React.FC = () => {
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Segurança</h2>
            <p className="text-white/40 text-sm">Auditoria e controle de acesso.</p>
          </div>
          <button className="vision-btn px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2">
            <ShieldAlert size={18} /> Bloquear IP
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Audit Logs */}
          <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Activity size={18} className="text-blue-500" /> Logs de Auditoria
              </h3>
              <button className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest">Ver Todos</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Ação</th>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">IP</th>
                    <th className="px-6 py-4">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className={`px-2 py-1 rounded border ${
                          log.status === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                          log.status === 'warning' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/60">{log.user}</td>
                      <td className="px-6 py-4 text-white/40 font-mono text-xs">{log.ip}</td>
                      <td className="px-6 py-4 text-white/40">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* IP Blacklist */}
          <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Lock size={18} className="text-red-500" /> Lista Negra (IP Blacklist)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">IP</th>
                    <th className="px-6 py-4">Motivo</th>
                    <th className="px-6 py-4">Expira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {blacklist.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-red-400">{item.ip}</td>
                      <td className="px-6 py-4 text-white/60">{item.reason}</td>
                      <td className="px-6 py-4 text-white/40 text-xs">{item.expires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Global Security Settings */}
        <div className="bg-[#121217] border border-white/5 rounded-3xl p-8">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Globe size={18} className="text-purple-500" /> Configurações de Acesso Global
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                   <h4 className="font-bold text-sm">Bloqueio Geográfico</h4>
                   <p className="text-xs text-white/40 mt-1">Permitir apenas IPs do Brasil</p>
                </div>
                <div className="w-12 h-6 bg-green-600 rounded-full relative cursor-pointer">
                   <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md"></div>
                </div>
             </div>
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                   <h4 className="font-bold text-sm">Proteção DDoS</h4>
                   <p className="text-xs text-white/40 mt-1">Cloudflare Under Attack Mode</p>
                </div>
                <div className="w-12 h-6 bg-white/10 rounded-full relative cursor-pointer">
                   <div className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full shadow-md"></div>
                </div>
             </div>
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                   <h4 className="font-bold text-sm">2FA Obrigatório</h4>
                   <p className="text-xs text-white/40 mt-1">Para todos os administradores</p>
                </div>
                <div className="w-12 h-6 bg-green-600 rounded-full relative cursor-pointer">
                   <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Security;

import React, { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Search, Filter, MoreVertical, Edit2, Ban, Lock, Trash2, CheckCircle } from 'lucide-react';

const Subscribers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock Data
  const users = Array.from({ length: 10 }).map((_, i) => ({
    id: i + 1,
    name: `Assinante ${i + 1}`,
    email: `usuario${i + 1}@email.com`,
    plan: i % 3 === 0 ? 'Premium' : i % 2 === 0 ? 'Standard' : 'Básico',
    status: i === 4 ? 'Bloqueado' : 'Ativo',
    expiry: '2024-12-31',
    connections: `${Math.floor(Math.random() * 3)}/4`,
    lastLogin: 'Hoje, 14:30'
  }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Assinantes</h2>
            <p className="text-white/40 text-sm">Gerencie todos os usuários da plataforma.</p>
          </div>
          <button className="vision-btn px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all">
            + Novo Assinante
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-[#121217] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, email ou ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-600/50 transition-all placeholder:text-white/20"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium whitespace-nowrap">
              <Filter size={16} /> Filtros
            </button>
            <select className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium outline-none cursor-pointer">
              <option>Status: Todos</option>
              <option>Ativos</option>
              <option>Bloqueados</option>
              <option>Vencidos</option>
            </select>
            <select className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium outline-none cursor-pointer">
              <option>Plano: Todos</option>
              <option>Premium</option>
              <option>Standard</option>
              <option>Básico</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold border-b border-white/5">
                <tr>
                  <th className="px-6 py-5">
                    <input type="checkbox" className="rounded border-white/20 bg-white/5" />
                  </th>
                  <th className="px-6 py-5">Usuário</th>
                  <th className="px-6 py-5">Plano</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Conexões</th>
                  <th className="px-6 py-5">Vencimento</th>
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded border-white/20 bg-white/5" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center font-bold text-sm border border-white/10">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{user.name}</p>
                          <p className="text-white/40 text-xs">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        user.plan === 'Premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                        user.plan === 'Standard' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.status === 'Ativo' ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <Ban size={14} className="text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${user.status === 'Ativo' ? 'text-green-400' : 'text-red-400'}`}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-600 rounded-full" 
                            style={{ width: `${(parseInt(user.connections.split('/')[0]) / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-white/60">{user.connections}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60 font-mono">
                      {user.expiry}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-yellow-400 transition-colors" title="Resetar Senha">
                          <Lock size={16} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-500 transition-colors" title="Bloquear/Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="p-4 border-t border-white/5 flex justify-between items-center text-sm text-white/40">
            <p>Mostrando 1-10 de 128 resultados</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50">Anterior</button>
              <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10">Próximo</button>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

export default Subscribers;

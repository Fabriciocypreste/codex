import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Users, DollarSign, UserPlus, TrendingUp, MoreHorizontal } from 'lucide-react';

const resellers = [
  { id: 1, name: 'Carlos Mendes', email: 'carlos@revenda.com', clients: 450, commission: '15%', balance: 'R$ 1.250,00', status: 'Ativo' },
  { id: 2, name: 'Fernanda Lima', email: 'fernanda@iptv.net', clients: 230, commission: '12%', balance: 'R$ 890,50', status: 'Ativo' },
  { id: 3, name: 'Roberto Souza', email: 'beto@redx.com', clients: 85, commission: '10%', balance: 'R$ 120,00', status: 'Pendente' },
  { id: 4, name: 'Juliana Costa', email: 'ju@stream.com', clients: 12, commission: '10%', balance: 'R$ 0,00', status: 'Bloqueado' },
];

const Resellers: React.FC = () => {
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Revendedores</h2>
            <p className="text-white/40 text-sm">Gerencie parceiros e comissões.</p>
          </div>
          <button className="vision-btn px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2">
            <UserPlus size={18} /> Novo Revendedor
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Users size={24} />
              </div>
            </div>
            <h3 className="text-4xl font-black text-white mb-1">48</h3>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Total de Revendedores</p>
          </div>
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-2xl bg-green-500/10 text-green-500 border border-green-500/20">
                <DollarSign size={24} />
              </div>
            </div>
            <h3 className="text-4xl font-black text-white mb-1">R$ 12.450</h3>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Comissões Pagas (Mês)</p>
          </div>
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <TrendingUp size={24} />
              </div>
            </div>
            <h3 className="text-4xl font-black text-white mb-1">+15%</h3>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Crescimento de Vendas</p>
          </div>
        </div>

        {/* Resellers Table */}
        <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Clientes</th>
                  <th className="px-6 py-4">Comissão</th>
                  <th className="px-6 py-4">Saldo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resellers.map((reseller) => (
                  <tr key={reseller.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-white">{reseller.name}</p>
                        <p className="text-white/40 text-xs">{reseller.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold">{reseller.clients}</td>
                    <td className="px-6 py-4 text-white/60">{reseller.commission}</td>
                    <td className="px-6 py-4 text-green-400 font-bold">{reseller.balance}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        reseller.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 
                        reseller.status === 'Pendente' ? 'bg-yellow-500/10 text-yellow-500' : 
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {reseller.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Resellers;

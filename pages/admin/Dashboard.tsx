import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Users, TrendingUp, DollarSign, Activity, Film, Tv, Radio, RefreshCw } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { getDashboardStats, getMonthlyRevenue, getRecentTransactions, type DashboardStats } from '../../services/adminService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<{ month: string; receita: number; novos: number }[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, r, t] = await Promise.allSettled([
        getDashboardStats(),
        getMonthlyRevenue(),
        getRecentTransactions(5),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (r.status === 'fulfilled') setRevenueData(r.value);
      if (t.status === 'fulfilled') setTransactions(t.value);
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => { setRefreshing(true); loadData(); };
  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const statCards = stats ? [
    { label: 'Assinantes Ativos', value: stats.activeSubscribers.toLocaleString(), sub: `de ${stats.totalSubscribers.toLocaleString()} total`, icon: Users, color: 'from-blue-600 to-blue-400' },
    { label: 'Receita Total', value: formatCurrency(stats.totalRevenue), sub: 'transações pagas', icon: DollarSign, color: 'from-green-600 to-green-400' },
    { label: 'Filmes', value: stats.totalMovies.toLocaleString(), sub: 'no catálogo', icon: Film, color: 'from-red-600 to-red-400' },
    { label: 'Séries', value: stats.totalSeries.toLocaleString(), sub: 'no catálogo', icon: Tv, color: 'from-purple-600 to-purple-400' },
    { label: 'Canais Live', value: stats.totalChannels.toLocaleString(), sub: 'cadastrados', icon: Radio, color: 'from-cyan-600 to-cyan-400' },
  ] : [];

  const contentStats = stats ? [
    { name: 'Filmes', value: stats.totalMovies },
    { name: 'Séries', value: stats.totalSeries },
    { name: 'Canais', value: stats.totalChannels },
  ] : [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Visão Geral</h2>
            <p className="text-white/40 text-sm">Monitoramento em tempo real da plataforma RED X.</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-20 mb-4" />
                <div className="h-8 bg-white/10 rounded w-24 mb-2" />
                <div className="h-3 bg-white/5 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {statCards.map((stat, idx) => (
                <div key={idx} className="relative overflow-hidden bg-white/5 border border-white/10 rounded-3xl p-6 group hover:border-white/20 transition-all duration-300">
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 blur-2xl rounded-full -mr-10 -mt-10 group-hover:opacity-20`} />
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-white/5 text-white ring-1 ring-white/10"><stat.icon size={20} /></div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black tracking-tighter text-white mb-1">{stat.value}</h3>
                    <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-[10px] text-white/25 mt-1">{stat.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#121217] border border-white/5 rounded-3xl p-6 md:p-8">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-8"><TrendingUp size={18} className="text-red-500" /> Receita Mensal</h3>
                <div className="h-[300px] w-full min-h-[300px]">
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs><linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E50914" stopOpacity={0.3} /><stop offset="95%" stopColor="#E50914" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="month" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1A1A20', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff' }} formatter={(value: number) => [formatCurrency(value), 'Receita']} />
                        <Area type="monotone" dataKey="receita" stroke="#E50914" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/20 text-center">
                      <div><Activity size={48} className="mx-auto mb-4 opacity-50" /><p className="font-bold">Sem dados de receita</p><p className="text-xs text-white/15 mt-1">Transações aparecerão aqui quando houver pagamentos</p></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[#121217] border border-white/5 rounded-3xl p-6 md:p-8">
                <h3 className="font-bold text-lg mb-8 flex items-center gap-2"><Film size={18} className="text-blue-500" /> Conteúdo no Catálogo</h3>
                <div className="h-[300px] w-full min-h-[300px]">
                  {contentStats.some(c => c.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={contentStats} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" stroke="#ffffff60" fontSize={12} tickLine={false} axisLine={false} width={80} />
                        <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#1A1A20', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/20"><p className="font-bold text-sm">Catálogo vazio</p></div>
                  )}
                </div>
              </div>
            </div>

            {/* Transações Recentes */}
            <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/5"><h3 className="font-bold text-lg">Últimas Transações</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                    <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Valor</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Data</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-white/20"><DollarSign size={32} className="mx-auto mb-2 opacity-30" /><p className="font-bold">Nenhuma transação registrada</p><p className="text-xs text-white/15 mt-1">Transações aparecerão quando houver pagamentos</p></td></tr>
                    ) : transactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-white/40">{t.id?.substring(0, 8)}...</td>
                        <td className="px-6 py-4 font-bold text-green-400">{formatCurrency(parseFloat(t.amount) || 0)}</td>
                        <td className="px-6 py-4 text-white/60 capitalize">{t.payment_method || 'N/A'}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'paid' ? 'bg-green-500/10 text-green-500' : t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>{t.status === 'paid' ? 'Pago' : t.status === 'pending' ? 'Pendente' : t.status}</span></td>
                        <td className="px-6 py-4 text-white/40 text-xs">{new Date(t.created_at).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

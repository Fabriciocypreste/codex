import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { Users, TrendingUp, DollarSign, Activity, AlertCircle, Monitor } from 'lucide-react';
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
  Legend
} from 'recharts';

// Mock Data
const stats = [
  { 
    label: 'Total Assinantes', 
    value: '12,450', 
    change: '+12%', 
    trend: 'up', 
    icon: Users,
    color: 'from-blue-600 to-blue-400'
  },
  { 
    label: 'Receita Mensal', 
    value: 'R$ 458.9k', 
    change: '+8.2%', 
    trend: 'up', 
    icon: DollarSign,
    color: 'from-green-600 to-green-400'
  },
  { 
    label: 'Logins Hoje', 
    value: '8,234', 
    change: '+24%', 
    trend: 'up', 
    icon: Activity,
    color: 'from-purple-600 to-purple-400'
  },
  { 
    label: 'Churn Rate', 
    value: '2.4%', 
    change: '-0.5%', 
    trend: 'down', 
    icon: AlertCircle,
    color: 'from-red-600 to-red-400'
  },
];

const revenueData = [
  { name: 'Jan', receita: 320000, novos: 1200 },
  { name: 'Fev', receita: 350000, novos: 1400 },
  { name: 'Mar', receita: 380000, novos: 1600 },
  { name: 'Abr', receita: 410000, novos: 1800 },
  { name: 'Mai', receita: 430000, novos: 2000 },
  { name: 'Jun', receita: 458000, novos: 2400 },
];

const deviceData = [
  { name: 'Smart TV', value: 45 },
  { name: 'TV Box', value: 30 },
  { name: 'Mobile', value: 15 },
  { name: 'Web', value: 10 },
];

const Dashboard: React.FC = () => {
  return (
    <AdminLayout>
      <div className="space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Visão Geral</h2>
            <p className="text-white/40 text-sm">Monitoramento em tempo real da plataforma RED X.</p>
          </div>
          <div className="flex gap-2 text-xs font-bold bg-white/5 p-1 rounded-lg border border-white/10">
            <button className="px-4 py-1.5 rounded-md bg-white/10 text-white shadow-sm">Hoje</button>
            <button className="px-4 py-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors">7D</button>
            <button className="px-4 py-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors">30D</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="relative overflow-hidden bg-white/5 border border-white/10 rounded-3xl p-6 group hover:border-white/20 transition-all duration-300">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 blur-2xl rounded-full -mr-10 -mt-10 transition-opacity group-hover:opacity-20`}></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-3 rounded-2xl bg-white/5 text-white ring-1 ring-white/10`}>
                  <stat.icon size={20} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {stat.change}
                </span>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-3xl font-black tracking-tighter text-white mb-1">{stat.value}</h3>
                <p className="text-sm font-medium text-white/40 uppercase tracking-widest text-[10px]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-[#121217] border border-white/5 rounded-3xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp size={18} className="text-red-500" />
                Crescimento de Receita
              </h3>
            </div>
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E50914" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#E50914" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A20', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="receita" stroke="#E50914" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Chart */}
          <div className="bg-[#121217] border border-white/5 rounded-3xl p-6 md:p-8">
            <h3 className="font-bold text-lg mb-8 flex items-center gap-2">
              <Monitor size={18} className="text-blue-500" />
              Dispositivos Ativos
            </h3>
            <div className="h-[300px] w-full min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deviceData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#ffffff60" fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <Tooltip 
                      cursor={{fill: '#ffffff05'}}
                      contentStyle={{ backgroundColor: '#1A1A20', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity Table (Simplified) */}
        <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-lg">Últimos Logins</h3>
            <button className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest">Ver Todos</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">IP</th>
                  <th className="px-6 py-4">Dispositivo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">U{i}</div>
                      user_{i}@email.com
                    </td>
                    <td className="px-6 py-4 text-white/60">192.168.1.{10+i}</td>
                    <td className="px-6 py-4 text-white/60">Android TV</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">Online</span>
                    </td>
                    <td className="px-6 py-4 text-white/40">Há {i * 5} min</td>
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

export default Dashboard;

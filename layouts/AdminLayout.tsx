import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Tv,
  Film,
  CreditCard,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Database
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Assinantes', path: '/admin/subscribers' },
    { icon: Tv, label: 'Canais IPTV', path: '/admin/iptv' },
    { icon: Film, label: 'Catálogo VOD', path: '/admin/vod' },
    { icon: Database, label: 'Importação e Limpeza', path: '/admin/ingestion' },
    { icon: CreditCard, label: 'Financeiro', path: '/admin/finance' },
    { icon: Users, label: 'Revendedores', path: '/admin/resellers' },
    { icon: ShieldAlert, label: 'Segurança', path: '/admin/security' },
    { icon: Settings, label: 'Configurações', path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white flex font-sans selection:bg-red-600/30">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#121217] border-r border-white/5 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static lg:inset-auto`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center px-8 border-b border-white/5">
            <div className="flex items-center gap-2 font-black italic tracking-tighter text-2xl">
              <span className="text-white">RED</span>
              <span className="text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">X</span>
              <span className="text-[10px] not-italic font-normal text-white/40 ml-2 mt-1 tracking-widest uppercase">CRM</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Principal</p>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                    ? 'bg-red-600/10 text-red-500 border border-red-600/20 shadow-[0_0_20px_rgba(220,38,38,0.1)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <item.icon size={18} className={`transition-colors ${isActive ? 'text-red-500' : 'group-hover:text-white'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold text-sm">
                AD
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Admin Master</p>
                <p className="text-xs text-white/40 truncate">admin@redx.com</p>
              </div>
              <button className="p-2 hover:text-red-500 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0B0F]">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 bg-[#0B0B0F]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-white/60 hover:text-white"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-xl font-bold hidden md:block">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Admin'}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                placeholder="Buscar em todo CRM..."
                className="w-64 lg:w-96 bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 transition-all placeholder:text-white/20"
              />
            </div>
            <button className="relative p-2 text-white/60 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
            </button>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

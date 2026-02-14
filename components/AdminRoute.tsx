import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Eye, EyeOff, LogIn } from 'lucide-react';

/**
 * AdminRoute — Proteção das rotas /admin/*
 * 
 * Modo atual: senha fixa definida em VITE_ADMIN_PASSWORD
 * Futuramente: verificar role de admin via Supabase user metadata
 * 
 * Se VITE_ADMIN_PASSWORD não estiver definido, o acesso é livre (dev mode).
 */

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

// Chave para persistir sessão admin no sessionStorage
const ADMIN_SESSION_KEY = 'redx_admin_authenticated';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Se não tem senha configurada, permite acesso livre (modo desenvolvimento)
  if (!ADMIN_PASSWORD) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0B0F]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E50914]" />
      </div>
    );
  }

  // Já autenticado nesta sessão
  if (authenticated) {
    return <>{children}</>;
  }

  // Tela de login do admin
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError('Senha incorreta');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 font-black italic tracking-tighter text-4xl mb-2">
            <span className="text-white">RED</span>
            <span className="text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">X</span>
          </div>
          <p className="text-white/40 text-sm tracking-widest uppercase">Painel Administrativo</p>
        </div>

        {/* Card */}
        <div className="bg-[#121217] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
              <p className="text-white/40 text-xs">Digite a senha de administrador</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Senha do admin..."
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white 
                           focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 
                           transition-all placeholder:text-white/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 
                         text-white font-bold py-3 rounded-xl transition-all 
                         shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]"
            >
              <LogIn size={18} />
              Entrar
            </button>
          </form>

          {user && (
            <p className="text-white/20 text-xs text-center mt-4">
              Logado como: {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRoute;

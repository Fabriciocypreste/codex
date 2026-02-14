import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC<{ onLogin: () => void; onAdminAccess?: () => void }> = ({ onLogin, onAdminAccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setPosition } = useSpatialNav();

  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError("Falha ao entrar: " + error);
        setIsLoading(false);
      } else {
        // Success - AuthContext will update state, we just notify parent to switch page
        setIsLoading(false);
        onLogin();
      }
    } catch (err) {
      setError("Erro de conexão");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_#990000_0%,_#000000_70%)] flex items-center justify-center overflow-hidden font-sans" data-nav-row="0">

      <div className="relative z-10 w-full max-w-[350px] px-4">
        <div className="bg-white/10 backdrop-blur-[15px] border border-white/10 p-8 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] aspect-square flex flex-col justify-between">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-[#E50914] p-1.5 rounded-lg">
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white">RedFlix</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-[#E50914] tracking-widest ml-4">E-mail</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setPosition(0, 1); }
                    if (e.key === 'Enter') { e.preventDefault(); setPosition(0, 1); }
                  }}
                  placeholder="seuemail@exemplo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-5 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all text-white placeholder-white/20"
                  data-nav-item
                  data-nav-col="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-[#E50914] tracking-widest ml-4">Senha</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); setPosition(0, 0); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); setPosition(0, 2); }
                    if (e.key === 'Enter') { e.preventDefault(); (document.getElementById('login-submit') as HTMLButtonElement)?.click(); }
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all text-white placeholder-white/20"
                  data-nav-item
                  data-nav-col="1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 accent-[#E50914]" />
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">Lembrar-me</span>
              </label>
              <button type="button" className="text-xs text-gray-400 hover:text-white transition-colors">Esqueceu a senha?</button>
            </div>

            <button
              id="login-submit"
              type="submit"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); setPosition(0, 1); }
                if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLButtonElement).click(); }
              }}
              className="w-full bg-gradient-to-r from-[#E50914] to-[#b20710] py-3 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-900/20 group"
              data-nav-item
              data-nav-col="2"
            >
              Entrar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Novo por aqui? <button className="text-[#E50914] font-bold hover:underline">Criar conta</button>
            </p>
            <button
              type="button"
              onClick={() => onAdminAccess?.()}
              className="mt-4 text-[10px] text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest font-bold"
            >
              Acesso Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

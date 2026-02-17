import React, { useState, useRef, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { UserProfile } from '../types';
import { playNavigateSound, playSelectSound, playBackSound } from '../utils/soundEffects';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import {
  getUserSettings,
  getUserSubscription,
  getAllPlans,
  getPaymentMethods,
  getUserDevices,
  addDevice as apiAddDevice,
  removeDevice as apiRemoveDevice,
  getUserProfiles,
  addUserProfile,
  UserSettings,
  Plan,
  Subscription,
  PaymentMethod,
  Device,
  UserProfileDB
} from '../services/supabaseService';

// --- Helper Components ---

const useTiltEffect = (intensity = 15) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !cardRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = (rect.height / 2 - y) / intensity;
    const rotateY = (x - rect.width / 2) / intensity;

    cardRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    containerRef.current.style.setProperty('--x', `${x}px`);
    containerRef.current.style.setProperty('--y', `${y}px`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
  };

  return { containerRef, cardRef, handleMouseMove, handleMouseLeave };
};

const TiltCard: React.FC<{ children: React.ReactNode; className?: string; innerClassName?: string; intensity?: number }> = ({ children, className = '', innerClassName = '', intensity = 15 }) => {
  const { containerRef, cardRef, handleMouseMove, handleMouseLeave } = useTiltEffect(intensity);
  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className={`tilt-container relative ${className}`}>
      <div ref={cardRef} className={`tilt-card relative h-full transition-transform duration-300 ease-out ${innerClassName}`}>
        <div className="tilt-shine"></div>
        {children}
      </div>
    </div>
  );
};

const VisionKeyboard: React.FC<{ onKeyClick: (key: string) => void; onBackspace: () => void }> = ({ onKeyClick, onBackspace }) => {
  const keys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?']
  ];

  return (
    <div className="space-y-2 md:space-y-4 p-4 md:p-8 bg-white/5 rounded-4xl md:rounded-[3rem] backdrop-blur-xl shadow-2xl overflow-x-auto no-scrollbar w-full max-w-full border border-white/10">
      {keys.map((row, i) => (
        <div key={i} className="flex justify-start md:justify-center gap-2 md:gap-4 min-w-max md:min-w-0">
          {row.map(key => (
            <button key={key} onClick={() => onKeyClick(key)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onKeyClick(key); } }} tabIndex={0} className="keyboard-key shrink-0 w-10! h-10! md:w-15! md:h-15! text-sm! md:text-xl! focus:outline-none focus:ring-2 focus:ring-[#E50914]">
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-2 md:gap-4 pt-2 md:pt-4">
        <button onClick={() => onKeyClick(' ')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onKeyClick(' '); } }} tabIndex={0} className="keyboard-key w-40! md:w-75! h-10! md:h-15! rounded-full! text-xs! md:text-sm! focus:outline-none focus:ring-2 focus:ring-[#E50914]">ESPAÇO</button>
        <button onClick={onBackspace} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onBackspace(); } }} tabIndex={0} className="keyboard-key w-20! md:w-35! h-10! md:h-15! rounded-full! text-red-500 text-xs! md:text-sm! focus:outline-none focus:ring-2 focus:ring-[#E50914]">APAGAR</button>
      </div>
    </div>
  );
};

// --- Settings Components ---

const SettingsCard: React.FC<{
  title: string;
  description?: string;
  icon: React.ReactNode;
  badge?: string;
  onClick?: () => void;
  accent?: boolean;
}> = ({ title, description, icon, badge, onClick, accent }) => (
  <GlassPanel
    className={`py-6! px-8! hover:bg-white/5 transition-all cursor-pointer group rounded-[2.5rem]! border ${accent ? 'border-red-600/30' : 'border-white/5'} flex items-center justify-between outline-none focus-within:ring-2 focus-within:ring-[#E50914]`}
    onClick={() => { playSelectSound(); onClick?.(); }}
    tabIndex={0}
    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onClick?.(); } }}
  >
    <div className="flex items-center gap-6">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ${accent ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60 group-hover:text-white transition-colors'}`}>
        {icon}
      </div>
      <div>
        <h5 className="text-lg font-black tracking-tight flex items-center gap-3">
          {title}
          {badge && <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-500 bg-red-600/10 px-2 py-0.5 rounded-md">{badge}</span>}
        </h5>
        {description && <p className="text-xs text-white/40 font-light leading-relaxed">{description}</p>}
      </div>
    </div>
    <svg className="w-4 h-4 text-white/10 group-hover:text-white transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
  </GlassPanel>
);

const Settings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  // Disable SpatialNav — Settings has own D-Pad handler
  const { setEnabled } = useSpatialNav();
  useEffect(() => {
    setEnabled(false);
    return () => setEnabled(true);
  }, [setEnabled]);

  const [activeTab, setActiveTab] = useState('profiles');
  const [currentSubView, setCurrentSubView] = useState<string | null>(null);

  // Data States
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [profiles, setProfiles] = useState<UserProfileDB[]>([]);

  // UI States
  const [currentPlanId, setCurrentPlanId] = useState('premium');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileIcon, setNewProfileIcon] = useState('bg-blue-600');
  const [isKidsProfile, setIsKidsProfile] = useState(false);
  const [parentalPin, setParentalPin] = useState('');
  const [selectedParentalRating, setSelectedParentalRating] = useState('14+');

  // Payment states
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4412');
  const [cardHolder, setCardHolder] = useState('FABRICIO SILVA');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [focusedField, setFocusedField] = useState<'number' | 'holder' | 'expiry' | 'code'>('number');
  const [promoCode, setPromoCode] = useState('');

  // Fallback data if DB is empty/unreachable
  const DEFAULT_PLANS = [
    { id: 'basic', name: 'Basic', price: 'R$ 25,90', quality: 'HD (720p)', screens: '1 tela', features: ['Downloads limitados', 'Com anúncios leves', 'Som Estéreo'], color: 'bg-zinc-600', deviceLimit: 1 },
    { id: 'standard', name: 'Standard', price: 'R$ 44,90', quality: 'Full HD (1080p)', screens: '2 telas', features: ['Downloads ilimitados', 'Sem anúncios', 'Som Surround 5.1'], color: 'bg-blue-600', deviceLimit: 2 },
    { id: 'premium', name: 'Premium Spatial', price: 'R$ 59,90', quality: 'Spatial 4K + Vision', screens: '4 telas', features: ['4 telas simultâneas', 'Downloads ilimitados', 'Sem anúncios', 'Spatial Audio Experience'], color: 'bg-red-600', deviceLimit: 3 },
  ];

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      // Mock User ID for demo
      const userId = 'user_123';

      try {
        const [p, sub, methods, devs, profs, settings] = await Promise.all([
          getAllPlans(),
          getUserSubscription(userId),
          getPaymentMethods(userId),
          getUserDevices(userId),
          getUserProfiles(userId),
          getUserSettings(userId)
        ]);

        setPlans(p.length > 0 ? p : DEFAULT_PLANS as any); // Cast for fallback compatibility
        setSubscription(sub);
        setPaymentMethods(methods);
        setDevices(devs.length > 0 ? devs : [
          { id: '1', name: 'Apple Vision Pro', type: 'Spatial Computer', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', last_active: new Date().toISOString(), is_current_session: true }
        ]);
        setProfiles(profs.length > 0 ? profs : [
          { id: '1', name: 'FABRICIO', avatar_color: 'bg-blue-600', is_kids: false },
          { id: '2', name: 'Infantil', avatar_color: 'bg-green-600', is_kids: true }
        ]);
        setUserSettings(settings || {
          id: '1', user_id: userId, email: 'fabricio@red-x.com', name: 'Fabricio Silva', two_factor_enabled: true
        });

        if (sub?.plan_id) setCurrentPlanId(sub.plan_id);

        // Load Persistent Local Settings
        const savedRating = localStorage.getItem('redx_parental_rating');
        if (savedRating) setSelectedParentalRating(savedRating);

        const savedPin = localStorage.getItem('redx_parental_pin');
        if (savedPin) setParentalPin(savedPin);

      } catch (err) {
        console.error("Error loading settings:", err);
        // Fallback
        setPlans(DEFAULT_PLANS as any);
        setDevices([
          { id: '1', name: 'Apple Vision Pro', type: 'Spatial Computer', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', last_active: new Date().toISOString(), is_current_session: true }
        ]);
        setProfiles([
          { id: '1', name: 'FABRICIO', avatar_color: 'bg-blue-600', is_kids: false },
          { id: '2', name: 'Infantil', avatar_color: 'bg-green-600', is_kids: true }
        ]);
        setUserSettings({
          id: '1', user_id: userId, email: 'fabricio@red-x.com', name: 'Fabricio Silva', two_factor_enabled: true
        });
      }
    };
    loadData();
  }, []);

  const currentPlan = (plans.find(p => p.id === currentPlanId) || plans[2] || DEFAULT_PLANS[2]) as any;
  const pendingPlan = (plans.find(p => p.id === pendingPlanId) || null) as any;

  const handleRemoveDevice = async (id: string) => {
    // Optimistic update
    setDevices(prev => prev.filter(d => d.id !== id));
    await apiRemoveDevice(id);
  };

  const handleAddDevice = async () => {
    if (devices.length >= currentPlan.deviceLimit) {
      alert(`Limite de aparelhos atingido para o plano ${currentPlan.name}. Por favor, remova um dispositivo ou faça upgrade do plano.`);
      return;
    }

    const pool = [
      { name: 'Apple TV 4K', type: 'Set-top Box', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
      { name: 'PlayStation 5', type: 'Console', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { name: 'iPad Pro M4', type: 'Tablet', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
      { name: 'MacBook Air', type: 'Laptop', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
    ];
    const random = pool[Math.floor(Math.random() * pool.length)];

    // Call API
    const newDevice = await apiAddDevice({
      user_id: 'user_123',
      name: random.name,
      type: random.type,
      icon: random.icon,
      is_current_session: false
    });

    if (newDevice) setDevices(prev => [...prev, newDevice]);
  };

  const menuItems = [
    { id: 'overview', label: 'Visão geral', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'subscription', label: 'Assinatura', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'security', label: 'Segurança', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'devices', label: 'Aparelhos', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'profiles', label: 'Perfis', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];

  const handleTabChange = (id: string) => {
    playSelectSound();
    setActiveTab(id);
    setCurrentSubView(null);
  };

  // --- D-Pad Navigation for Settings ---
  const sidebarRef = useRef<HTMLElement>(null);
  const [focusedMenuIdx, setFocusedMenuIdx] = useState(-1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Handle Escape/Backspace → go back from subView or from Settings
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        playBackSound();
        if (currentSubView) {
          setCurrentSubView(null);
        } else {
          onBack();
        }
        return;
      }

      // If sidebar is focused (no subView active or sidebar has focus), handle Up/Down/Enter
      if (!currentSubView) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = Math.min(focusedMenuIdx + 1, menuItems.length - 1);
          if (next !== focusedMenuIdx) {
            playNavigateSound();
            setFocusedMenuIdx(next);
            // Focus the sidebar button
            const btns = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('[data-settings-nav]');
            btns?.[next]?.focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = Math.max(focusedMenuIdx - 1, 0);
          if (prev !== focusedMenuIdx) {
            playNavigateSound();
            setFocusedMenuIdx(prev);
            const btns = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('[data-settings-nav]');
            btns?.[prev]?.focus();
          }
        } else if (e.key === 'Enter' && focusedMenuIdx >= 0) {
          e.preventDefault();
          const item = menuItems[focusedMenuIdx];
          if (item) handleTabChange(item.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSubView, focusedMenuIdx, menuItems, onBack]);

  const handleKeyClick = (key: string) => {
    if (currentSubView === 'payment-method') {
      if (focusedField === 'number') setCardNumber(p => p + key);
      else if (focusedField === 'holder') setCardHolder(p => p + key);
      else if (focusedField === 'expiry') setCardExpiry(p => p + key);
    } else if (currentSubView === 'redeem-code') {
      setPromoCode(p => p + key);
    } else if (currentSubView === 'add-profile') {
      setNewProfileName(p => p + key);
    } else if (currentSubView === 'parental-control') {
      if (parentalPin.length < 4 && /^\d+$/.test(key)) setParentalPin(p => p + key);
    }
  };

  const handleBackspace = () => {
    if (currentSubView === 'payment-method') {
      if (focusedField === 'number') setCardNumber(p => p.slice(0, -1));
      else if (focusedField === 'holder') setCardHolder(p => p.slice(0, -1));
      else if (focusedField === 'expiry') setCardExpiry(p => p.slice(0, -1));
    } else if (currentSubView === 'redeem-code') {
      setPromoCode(p => p.slice(0, -1));
    } else if (currentSubView === 'add-profile') {
      setNewProfileName(p => p.slice(0, -1));
    } else if (currentSubView === 'parental-control') {
      setParentalPin(p => p.slice(0, -1));
    }
  };

  const renderContent = () => {
    if (currentSubView) {
      return renderSubView();
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-8xl font-black tracking-tighter">Visão geral</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Sua central de controle RED X</p>
            </div>
            <GlassPanel className="p-10! rounded-[3rem]! border border-white/10 space-y-12 shadow-3xl">
              <div className="flex flex-col md:flex-row items-center gap-10 border-b border-white/5 pb-12">
                <div className="w-32 h-32 rounded-[2.5rem] bg-blue-600 flex items-center justify-center text-5xl font-black shadow-3xl text-white">
                  {userSettings?.name ? userSettings.name[0] : 'F'}
                </div>
                <div className="flex-1 text-center md:text-left space-y-3">
                  <h3 className="text-4xl font-black tracking-tight">{userSettings?.name || 'Carregando...'}</h3>
                  <p className="text-white/40 font-light text-lg">{userSettings?.email || '...'}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border ${currentPlanId === 'premium' ? 'text-red-500 bg-red-600/10 border-red-600/20' : 'text-blue-500 bg-blue-600/10 border-blue-600/20'}`}>
                      Membro {currentPlan?.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">Ativo há 2 anos</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Planos & Pagamentos</p>
                  <div className="space-y-2">
                    <p className="font-bold text-lg">{currentPlan?.name}</p>
                    <p className="text-xs text-white/40">Próxima fatura: 12 de Jan, 2025</p>
                    <p className="text-xs text-white/40">Cartão •••• {cardNumber.slice(-4)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Aparelhos Ligados</p>
                  <div className="space-y-2">
                    <p className="font-bold text-lg">{devices.length} de {currentPlan?.device_limit || 3} Dispositivos</p>
                    <p className="text-xs text-white/40">Vision Pro (Ativo)</p>
                    <p className="text-xs text-white/40">{devices.length > 1 ? `e outros ${devices.length - 1}` : 'Nenhum outro'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Preferências</p>
                  <div className="space-y-2">
                    <p className="font-bold text-lg">Português (Brasil)</p>
                    <p className="text-xs text-white/40">Legendas: Ativadas</p>
                    <p className="text-xs text-white/40">Qualidade: {currentPlan?.quality}</p>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        );
      case 'subscription':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="space-y-2">
              <h2 className="text-4xl md:text-8xl font-black tracking-tighter">Assinatura</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600">SEU PORTAL DE BENEFÍCIOS ILIMITADOS</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7">
                <GlassPanel className={`p-0! rounded-[3rem]! border ${currentPlanId === 'premium' ? 'border-red-600/20' : 'border-white/10'} bg-black/40 shadow-3xl overflow-hidden`}>
                  <div className="p-12 space-y-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-4xl font-black tracking-tighter mb-4">Plano {currentPlan?.name}</h3>
                        <p className="text-lg text-white/60 font-light leading-relaxed max-w-lg">Qualidade {currentPlan?.quality} e streaming em até {currentPlan?.screens}.</p>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${currentPlanId === 'premium' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60'}`}>Ativo</div>
                    </div>
                    <div className="space-y-4">
                      {currentPlan?.features?.map((feat: string, i: number) => (
                        <div key={i} className="flex items-center gap-4 text-base font-bold text-white/90">
                          <svg className={`w-5 h-5 ${currentPlanId === 'premium' ? 'text-red-600' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                          {feat}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-12 py-8 bg-white/5 flex items-center justify-between border-t border-white/5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">PRÓXIMA FATURA</p>
                      <p className="text-2xl font-black">12 de Jan, 2025</p>
                    </div>
                    <button
                      onClick={() => setCurrentSubView('change-plan')}
                      className={`vision-btn px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:text-white border ${currentPlanId === 'premium' ? 'text-red-500 border-red-600/10 hover:border-red-600/40' : 'text-blue-500 border-blue-600/10 hover:border-blue-600/40'}`}
                    >
                      ALTERAR PLANO
                    </button>
                  </div>
                </GlassPanel>
              </div>
              <div className="lg:col-span-5 space-y-8">
                <GlassPanel onClick={() => setCurrentSubView('payment-method')} className="p-8! rounded-[2.5rem]! border border-white/5 bg-white/5 shadow-xl cursor-pointer hover:bg-white/10 transition-all group">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">MÉTODO DE PAGAMENTO</h4>
                    <svg className="w-4 h-4 text-white/10 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black italic text-sm tracking-tighter">VISA</div>
                    <div>
                      <p className="font-black text-xl tracking-widest">{cardNumber.slice(-9)}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">EXPIRA {cardExpiry}</p>
                    </div>
                  </div>
                </GlassPanel>
                <GlassPanel onClick={() => setCurrentSubView('redeem-code')} className="p-8! rounded-[2.5rem]! border border-white/5 bg-white/5 shadow-xl cursor-pointer hover:bg-white/10 transition-all group">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">RESGATAR CÓDIGO</h4>
                    <svg className="w-4 h-4 text-white/10 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <button className="w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-white/10 group-hover:bg-white/20 transition-all text-white border border-white/5 shadow-lg">ADICIONAR CARTÃO PRESENTE</button>
                </GlassPanel>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-8xl font-black tracking-tighter">Segurança</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Protocolos de proteção espacial</p>
            </div>
            <div className="space-y-4">
              <SettingsCard
                onClick={() => setCurrentSubView('change-password')}
                title="Alterar Senha"
                description="Última alteração há 3 meses. Recomendamos mudar a cada 6 meses."
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
              />
              <SettingsCard
                onClick={() => setCurrentSubView('two-factor')}
                title="Autenticação em Duas Etapas"
                badge={userSettings?.two_factor_enabled ? "ATIVO" : "INATIVO"}
                accent={userSettings?.two_factor_enabled}
                description="Proteja sua conta com um código enviado ao seu dispositivo."
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              />
              <SettingsCard
                onClick={() => setCurrentSubView('passkeys')}
                title="Gerenciar Chaves de Acesso"
                description="Use biometria para entrar no RED X sem senhas."
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.268 0 2.39.606 3.107 1.554m-2.107 10.102V14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2h2.292" /></svg>}
              />
              <SettingsCard
                onClick={() => setCurrentSubView('sign-out-all')}
                title="Encerrar sessão em todos os aparelhos"
                description="Desconecta instantaneamente todos os dispositivos ligados a esta conta."
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
              />
            </div>
          </div>
        );
      case 'devices':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-8xl font-black tracking-tighter">Aparelhos</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">
                  LIMITE ATUAL: {devices.length} DE {currentPlan?.device_limit} ({currentPlan?.name})
                </p>
              </div>
              <button
                onClick={handleAddDevice}
                disabled={devices.length >= (currentPlan?.device_limit || 0)}
                className={`vision-btn px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 group shadow-2xl transition-all ${devices.length >= (currentPlan?.device_limit || 0) ? 'opacity-20 cursor-not-allowed' : 'text-red-500 hover:text-white border border-red-600/20'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white transition-all ${devices.length >= (currentPlan?.device_limit || 0) ? 'bg-zinc-700' : 'bg-red-600 group-hover:scale-110'}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4" /></svg>
                </div>
                Vincular Aparelho
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {devices.map((device) => (
                <GlassPanel key={device.id} className={`p-10! rounded-[3rem]! border ${device.is_current_session ? 'border-red-600/30 shadow-[0_0_50px_rgba(255,0,0,0.1)]' : 'border-white/5'} flex flex-col gap-6 group hover:border-white/20 transition-all animate-in zoom-in-95 duration-500`}>
                  <div className="flex items-center justify-between">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${device.is_current_session ? 'bg-red-600 text-white shadow-xl' : 'bg-white/5 text-white/40 group-hover:text-white transition-colors'}`}>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={device.icon} /></svg>
                    </div>
                    {device.is_current_session && <span className="text-[8px] font-black uppercase tracking-[0.4em] text-red-500 animate-pulse">SESSION_LIVE</span>}
                  </div>
                  <div>
                    <h5 className="text-2xl font-black tracking-tight">{device.name}</h5>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{device.type}</p>
                    <p className={`mt-6 text-sm ${device.is_current_session ? 'text-red-500 font-bold' : 'text-white/40 font-light'}`}>
                      {device.is_current_session ? 'Ativo agora' : new Date(device.last_active).toLocaleDateString()}
                    </p>
                  </div>
                  {!device.is_current_session && (
                    <button
                      onClick={() => handleRemoveDevice(device.id)}
                      className="vision-btn py-3 rounded-xl font-black text-[9px] uppercase tracking-widest text-white/20 hover:text-red-600"
                    >
                      Encerrar Sessão
                    </button>
                  )}
                </GlassPanel>
              ))}
            </div>
          </div>
        );
      case 'profiles':
      default:
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="space-y-4" style={{ marginTop: '3cm' }}>
              <h2 className="text-2xl md:text-5xl font-black tracking-tighter">Perfis</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Controle parental e permissões</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <SettingsCard
                onClick={() => setCurrentSubView('parental-control')}
                title="Ajustar o controle parental"
                description="Definir limites de classificação etária, bloquear títulos"
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
              <SettingsCard
                onClick={() => setCurrentSubView('add-profile')}
                title="Adicionar novo perfil"
                description="Criar uma nova identidade no ecossistema RED X"
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
              />
            </div>

            <div className="space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 border-b border-white/5 pb-4">Perfis configurados</h4>

              <div className="space-y-4">
                {profiles.map((prof, i) => (
                  <SettingsCard
                    key={i}
                    title={prof.name}
                    badge={prof.is_kids ? 'Kids Safe' : 'Seu Perfil'}
                    icon={
                      <div className={`w-full h-full rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center text-white font-black ${(prof as any).avatar_color || 'bg-blue-600'}`}>
                        {prof.name[0]}
                      </div>
                    }
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  setNewProfileName('');
                  setNewProfileIcon('bg-blue-600');
                  setIsKidsProfile(false);
                  setCurrentSubView('add-profile');
                }}
                className="w-full vision-btn py-10 rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.6em] text-white/30 hover:text-white hover:bg-white/10 border-dashed border-2 border-white/10 transition-all flex items-center justify-center gap-6 group"
              >
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white group-hover:text-black transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                </div>
                Adicionar perfil
              </button>
              <p className="text-center text-[9px] font-black uppercase tracking-[0.5em] text-white/10">Controle total sobre o ecossistema familiar RED X.</p>
            </div>
          </div>
        );
    }
  };

  const renderSubView = () => {
    switch (currentSubView) {
      case 'payment-method':
        return (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Método de Pagamento</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Cartões vinculados ao portal</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-6 space-y-8">
                <TiltCard intensity={20} className="w-full h-64" innerClassName="rounded-[2.5rem]! bg-linear-to-br! from-blue-900 to-indigo-950 p-10 flex flex-col justify-between shadow-3xl border border-white/20 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-14 h-10 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                      <div className="w-8 h-6 bg-linear-to-r from-yellow-600 to-yellow-400 rounded-sm"></div>
                    </div>
                    <span className="font-black italic text-2xl tracking-tighter">VISA</span>
                  </div>
                  <div className="space-y-6 relative z-10">
                    <p className="text-2xl md:text-3xl font-black tracking-[0.2em]">{cardNumber || '•••• •••• •••• ••••'}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-white/40">TITULAR</p>
                        <p className="font-bold text-sm tracking-widest">{cardHolder || 'NOME NO CARTÃO'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-white/40">VALIDADE</p>
                        <p className="font-bold text-sm">{cardExpiry || 'MM/AA'}</p>
                      </div>
                    </div>
                  </div>
                </TiltCard>

                <GlassPanel className="p-8! rounded-[2.5rem]! border border-white/5 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Ações Rápidas</h4>
                  <button onClick={() => { setIsEditingCard(true); setFocusedField('number'); }} className="w-full vision-btn py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-red-500">Substituir Cartão Atual</button>
                  <button className="w-full vision-btn py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white/20">Remover Método</button>
                </GlassPanel>
              </div>

              <div className="lg:col-span-6 space-y-8">
                <GlassPanel className={`p-10! rounded-[3rem]! border ${isEditingCard ? 'border-red-600/40 shadow-2xl' : 'border-white/5 opacity-50'} transition-all`}>
                  <h3 className="text-xl font-black tracking-tight mb-8">Informações do Cartão</h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase text-white/30 ml-4">NÚMERO DO CARTÃO</p>
                      <div
                        onClick={() => isEditingCard && setFocusedField('number')}
                        className={`w-full vision-btn py-4 px-6 rounded-2xl border ${focusedField === 'number' && isEditingCard ? 'border-red-600/50 bg-white/10' : 'border-white/5'} font-bold tracking-widest h-14 flex items-center`}
                      >
                        {cardNumber || 'Digite o número'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase text-white/30 ml-4">TITULAR</p>
                      <div
                        onClick={() => isEditingCard && setFocusedField('holder')}
                        className={`w-full vision-btn py-4 px-6 rounded-2xl border ${focusedField === 'holder' && isEditingCard ? 'border-red-600/50 bg-white/10' : 'border-white/5'} font-bold h-14 flex items-center`}
                      >
                        {cardHolder || 'Nome impresso'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase text-white/30 ml-4">VALIDADE</p>
                        <div
                          onClick={() => isEditingCard && setFocusedField('expiry')}
                          className={`w-full vision-btn py-4 px-6 rounded-2xl border ${focusedField === 'expiry' && isEditingCard ? 'border-red-600/50 bg-white/10' : 'border-white/5'} font-bold h-14 flex items-center`}
                        >
                          {cardExpiry || 'MM/AA'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase text-white/30 ml-4">CVV</p>
                        <div className="w-full vision-btn py-4 px-6 rounded-2xl border border-white/5 font-bold h-14 flex items-center">•••</div>
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={!isEditingCard}
                    onClick={() => {
                      setIsEditingCard(false);
                      setCurrentSubView(null);
                    }}
                    className="w-full vision-btn mt-10 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white shadow-3xl disabled:opacity-20"
                  >
                    SALVAR NOVO CARTÃO
                  </button>
                </GlassPanel>
              </div>
            </div>

            <div className="animate-in slide-in-from-bottom-10 duration-1000">
              <VisionKeyboard onKeyClick={handleKeyClick} onBackspace={handleBackspace} />
            </div>
          </div>
        );
      case 'redeem-code':
        return (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Resgatar Código</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Cartão presente ou voucher promocional</p>
              </div>
            </div>

            <div className="max-w-4xl mx-auto flex flex-col items-center space-y-16">
              <GlassPanel className="w-full p-12! md:p-20! rounded-[4rem]! border border-white/10 text-center space-y-10 shadow-3xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity blur-[100px]"></div>
                <div className="space-y-4 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.8em] text-white/20">INSIRA SEU CÓDIGO SPATIAL</p>
                  <div className="w-full py-8 text-4xl md:text-7xl font-black tracking-[0.3em] uppercase text-white placeholder:text-white/5 outline-none bg-transparent text-center border-b-2 border-white/10 focus:border-red-600 transition-all h-24 flex items-center justify-center">
                    {promoCode || 'XXXX-XXXX-XXXX'}
                  </div>
                </div>
                <div className="relative z-10">
                  <button
                    disabled={promoCode.length < 8}
                    onClick={() => {
                      setPromoCode('');
                      setCurrentSubView('plan-success');
                    }}
                    className="vision-btn px-20 py-8 rounded-full font-black text-xs uppercase tracking-[0.5em] bg-red-600 text-white shadow-[0_20px_80px_rgba(255,0,0,0.4)] hover:scale-110 disabled:opacity-20 disabled:scale-100 disabled:shadow-none"
                  >
                    RESGATAR AGORA
                  </button>
                </div>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-light italic">Válido para assinaturas Standard e Premium Vision.</p>
              </GlassPanel>

              <div className="w-full animate-in slide-in-from-bottom-10 duration-1000">
                <VisionKeyboard onKeyClick={handleKeyClick} onBackspace={handleBackspace} />
              </div>
            </div>
          </div>
        );
      case 'plan-success':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-12 animate-in zoom-in-95 duration-700">
            <div className="relative">
              <div className="absolute inset-0 bg-red-600/30 blur-[100px] rounded-full animate-pulse"></div>
              <div className="w-32 h-32 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_60px_rgba(255,0,0,0.4)] border-4 border-white/20 relative z-10 animate-bounce">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl md:text-8xl font-black tracking-tighter">Portal Atualizado!</h2>
              <p className="text-xl text-white/60 font-light max-w-lg mx-auto">Sua experiência RED X foi processada com sucesso. Aproveite o multiverso imersivo.</p>
            </div>
            <div className="thick-glass p-8! rounded-[2.5rem]! border border-white/10 w-full max-w-md">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">DETALHES DA TRANSAÇÃO</p>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-white/40 font-light">Assinatura</span>
                <span className="font-bold">{currentPlan?.name}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-white/40 font-light">Status</span>
                <span className="text-green-500 font-black uppercase text-[10px]">ATIVO AGORA</span>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentSubView(null);
                setActiveTab('subscription');
              }}
              className="vision-btn px-16 py-6 rounded-3xl font-black text-xs uppercase tracking-widest bg-red-600 text-white shadow-3xl hover:scale-110"
            >
              VOLTAR AO PAINEL
            </button>
          </div>
        );
      case 'checkout':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView('change-plan')} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Finalizar Plano</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Quase lá, {userSettings?.name || 'Fabricio'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7">
                <GlassPanel className="p-12! rounded-[3rem]! border border-white/10 space-y-10">
                  <div className="flex items-center gap-8">
                    <div className={`w-20 h-20 rounded-3xl ${pendingPlan?.color || 'bg-zinc-600'} flex items-center justify-center text-white shadow-3xl`}>
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <h3 className="text-3xl font-black">Plano {pendingPlan?.name}</h3>
                      <p className="text-white/40 font-light">Upgrade para experiência {pendingPlan?.quality}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-10 border-t border-white/5">
                    <div className="flex justify-between items-center text-lg">
                      <span className="text-white/30">Valor mensal</span>
                      <span className="font-bold">{pendingPlan?.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                      <span className="text-white/30">Taxa de processamento</span>
                      <span className="font-bold">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between items-center text-2xl pt-4 border-t border-white/5">
                      <span className="font-black tracking-tight">TOTAL</span>
                      <span className="font-black text-red-600">{pendingPlan?.price}</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">COBRAR EM</p>
                    <div className="vision-btn p-6 rounded-2xl flex justify-between items-center border border-white/5 bg-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 rounded bg-zinc-800 border border-white/10 flex items-center justify-center font-black italic text-[10px]">VISA</div>
                        <span className="font-bold tracking-widest">{cardNumber.slice(-9)}</span>
                      </div>
                      <button onClick={() => setCurrentSubView('payment-method')} className="text-[9px] font-black text-white/30 hover:text-white uppercase tracking-widest">ALTERAR</button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCurrentPlanId(pendingPlanId!);
                      setCurrentSubView('plan-success');
                    }}
                    className="w-full vision-btn py-6 rounded-3xl font-black text-xs uppercase tracking-widest bg-red-600 text-white shadow-[0_20px_50px_rgba(255,0,0,0.3)] hover:scale-[1.02]"
                  >
                    CONFIRMAR NOVA ASSINATURA
                  </button>
                  <p className="text-center text-[9px] font-light text-white/20 italic">Ao confirmar, você aceita os termos de uso Spatial da RED X.</p>
                </GlassPanel>
              </div>

              <div className="lg:col-span-5 space-y-8">
                <TiltCard intensity={15} innerClassName="rounded-[3rem]! border border-white/10 bg-white/5 p-10 space-y-6">
                  <h4 className="text-xl font-black tracking-tight">O que você ganha:</h4>
                  <div className="space-y-4">
                    {pendingPlan?.features?.map((f: string, i: number) => (
                      <div key={i} className="flex gap-4 items-start">
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-sm font-light text-white/70">{f}</span>
                      </div>
                    ))}
                  </div>
                </TiltCard>
              </div>
            </div>
          </div>
        );
      case 'change-plan':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Escolha seu Plano</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Ajuste sua experiência imersiva</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, i) => (
                <TiltCard key={i} intensity={10} className="h-full" innerClassName={`rounded-[3rem]! border ${currentPlanId === plan.id ? 'border-red-600 bg-red-600/5 shadow-[0_0_40px_rgba(255,0,0,0.1)]' : 'border-white/5 bg-white/5'} p-10 flex flex-col gap-8`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-3xl font-black">{plan.name}</h4>
                      {currentPlanId === plan.id && <span className="text-[8px] font-black uppercase text-red-500 tracking-widest px-2 py-1 bg-red-600/10 rounded">ATUAL</span>}
                    </div>
                    <p className="text-2xl font-light text-white/80">{plan.price}<span className="text-sm opacity-30">/mês</span></p>
                  </div>
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3 text-sm font-bold text-white/60">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      {plan.quality}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold text-white/60">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      {plan.screens}
                    </div>
                    {plan.id === 'premium' && (
                      <div className="flex items-center gap-3 text-sm font-bold text-white/60">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        Áudio Spatial Atmos
                      </div>
                    )}
                  </div>
                  <button
                    disabled={currentPlanId === plan.id}
                    onClick={() => {
                      setPendingPlanId(plan.id);
                      setCurrentSubView('checkout');
                    }}
                    className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${currentPlanId === plan.id ? 'bg-white/10 text-white/30 cursor-default' : 'bg-red-600 text-white hover:scale-105 shadow-xl'}`}
                  >
                    {currentPlanId === plan.id ? 'PLANO ATUAL' : 'SELECIONAR'}
                  </button>
                </TiltCard>
              ))}
            </div>
          </div>
        );
      case 'parental-control':
        return (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Controle Parental</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Segurança para toda a família</p>
              </div>
            </div>

            <div className="w-full max-w-4xl mx-auto space-y-12">
              <GlassPanel className="p-12! rounded-[3rem]! border border-white/10 space-y-12 shadow-3xl">
                <div className="space-y-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">LIMITE DE CLASSIFICAÇÃO ETÁRIA</p>
                  <div className="flex flex-wrap gap-4">
                    {['L', '10+', '12+', '14+', '16+', '18+'].map(rating => (
                      <button
                        key={rating}
                        onClick={() => setSelectedParentalRating(rating)}
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all border-4 ${selectedParentalRating === rating ? 'bg-red-600 border-white scale-110 shadow-2xl' : 'bg-white/5 border-transparent opacity-40 hover:opacity-100'}`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 font-light leading-relaxed italic">"Conteúdos acima de {selectedParentalRating} exigirão o PIN de acesso."</p>
                </div>

                <div className="pt-8 border-t border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">PIN DE ACESSO</p>
                    <span className="text-[8px] font-black uppercase text-red-500 tracking-widest">{parentalPin.length}/4 DÍGITOS</span>
                  </div>
                  <div className="flex gap-4 justify-center">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-12 h-16 rounded-2xl border flex items-center justify-center text-2xl font-black transition-all ${parentalPin[i] ? 'bg-red-600/20 border-red-600 text-white scale-110' : 'bg-white/5 border-white/10 text-white/10'}`}>
                        {parentalPin[i] ? '•' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => setCurrentSubView(null)} className="w-full vision-btn py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest bg-red-600 text-white shadow-3xl hover:scale-[1.02]">SALVAR CONFIGURAÇÕES</button>
              </GlassPanel>

              <div className="pt-4 animate-in slide-in-from-bottom-10 duration-700">
                <VisionKeyboard
                  onKeyClick={handleKeyClick}
                  onBackspace={handleBackspace}
                />
              </div>
            </div>
          </div>
        );
      case 'add-profile':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="space-y-1">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Adicionar Perfil</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600/60">Nova identidade no ecossistema RED X</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8">
                <GlassPanel className="p-12! rounded-[3.5rem]! border border-white/10 space-y-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">NOME DO PERFIL</p>
                      <div
                        className="w-full vision-btn py-6 px-10 rounded-3xl border border-white/5 bg-white/5 text-2xl font-light h-20 flex items-center"
                      >
                        {newProfileName || 'Como devemos chamar você?'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-8 rounded-3xl bg-white/5 border border-white/5">
                      <div>
                        <h4 className="text-xl font-black tracking-tight">Perfil Kids?</h4>
                        <p className="text-xs text-white/40 font-light">Exibe apenas conteúdos recomendados para crianças.</p>
                      </div>
                      <button
                        onClick={() => setIsKidsProfile(!isKidsProfile)}
                        className={`w-16 h-8 rounded-full transition-all relative ${isKidsProfile ? 'bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.4)]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${isKidsProfile ? 'left-9' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">ESCOLHA UM ÍCONE ESPACIAL</p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        'bg-blue-600',
                        'bg-red-600',
                        'bg-purple-600',
                        'bg-green-600',
                        'bg-linear-to-tr from-yellow-400 via-red-500 to-purple-600',
                        'bg-linear-to-br from-cyan-400 to-blue-600'
                      ].map((color, i) => (
                        <button
                          key={i}
                          onClick={() => setNewProfileIcon(color)}
                          className={`w-16 h-16 rounded-2xl ${color} transition-all border-4 ${newProfileIcon === color ? 'border-white scale-110 shadow-2xl' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 pt-8">
                    <button onClick={() => setCurrentSubView(null)} className="flex-1 vision-btn py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest bg-white/5 border border-white/5 text-white/40 hover:text-white">CANCELAR</button>
                    <button
                      onClick={async () => {
                        if (!newProfileName) return;
                        const newProfile = await addUserProfile({
                          user_id: 'user_123',
                          name: newProfileName,
                          avatar_color: newProfileIcon,
                          is_kids: isKidsProfile
                        });
                        if (newProfile) setProfiles(prev => [...prev, newProfile]);
                        setCurrentSubView(null);
                      }}
                      className="flex-1 vision-btn py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest bg-red-600 text-white shadow-[0_20px_50px_rgba(255,0,0,0.3)] disabled:opacity-20"
                      disabled={!newProfileName}
                    >
                      SALVAR PERFIL
                    </button>
                  </div>
                </GlassPanel>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="flex flex-col items-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-8">PRÉVIA DO PERFIL</p>
                  <TiltCard intensity={25} className="w-full max-w-70" innerClassName={`p-12! rounded-[4rem]! border border-white/10 thick-glass text-center space-y-6 flex flex-col items-center shadow-3xl`}>
                    <div className={`w-32 h-32 rounded-[2.5rem] ${newProfileIcon} flex items-center justify-center text-6xl font-black text-white shadow-3xl animate-float`} style={{ transform: 'translateZ(50px)' }}>
                      {newProfileName ? newProfileName[0].toUpperCase() : '?'}
                    </div>
                    <div style={{ transform: 'translateZ(30px)' }}>
                      <h3 className="text-3xl font-black tracking-tighter truncate w-full px-4">{newProfileName || 'Novo Perfil'}</h3>
                      {isKidsProfile && (
                        <span className="inline-block mt-2 text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">Modo Kids Ativo</span>
                      )}
                    </div>
                  </TiltCard>
                </div>
              </div>
            </div>

            <div className="pt-10 animate-in slide-in-from-bottom-10 duration-1000">
              <VisionKeyboard onKeyClick={handleKeyClick} onBackspace={handleBackspace} />
            </div>
          </div>
        );
      case 'change-password':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Alterar Senha</h2>
            </div>
            <GlassPanel className="p-12! rounded-[3rem]! border border-white/10 max-w-2xl space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">SENHA ATUAL</p>
                  <div className="w-full vision-btn py-5 px-8 rounded-2xl border border-white/5 text-xl font-light tracking-[0.5em] flex items-center">••••••••</div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">NOVA SENHA</p>
                  <div className="w-full vision-btn py-5 px-8 rounded-2xl border border-red-600/20 text-xl font-light tracking-[0.5em] bg-red-600/5 h-16 flex items-center"></div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 ml-4">CONFIRMAR NOVA SENHA</p>
                  <div className="w-full vision-btn py-5 px-8 rounded-2xl border border-white/5 text-xl font-light tracking-[0.5em] h-16 flex items-center"></div>
                </div>
              </div>
              <button onClick={() => setCurrentSubView(null)} className="w-full vision-btn vision-btn-highlight py-6 rounded-3xl font-black text-xs uppercase tracking-widest text-red-500 hover:text-white border border-red-600/20 shadow-2xl">SALVAR ALTERAÇÕES</button>
              <p className="text-center text-[10px] font-light text-white/20 italic">"Sua segurança é nossa prioridade no portal RED X."</p>
            </GlassPanel>
            <VisionKeyboard onKeyClick={() => { }} onBackspace={() => { }} />
          </div>
        );
      case 'two-factor':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Autenticação em Duas Etapas</h2>
            </div>
            <GlassPanel className="p-12! rounded-[3rem]! border border-red-600/30 bg-red-600/5 space-y-10">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 rounded-3xl bg-red-600 flex items-center justify-center text-white shadow-3xl">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tight">STATUS: {userSettings?.two_factor_enabled ? 'ATIVO' : 'INATIVO'}</h3>
                  <p className="text-white/60 font-light">Sua conta está protegida por verificação via dispositivo móvel.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-white/5">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">NÚMERO DE TELEFONE</p>
                  <div className="vision-btn p-6 rounded-2xl flex justify-between items-center bg-white/5 border border-white/5 h-16">
                    <span className="font-bold">{userSettings?.phone || '+55 •• ••••• ••••'}</span>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">VERIFICADO</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">E-MAIL DE RECUPERAÇÃO</p>
                  <div className="vision-btn p-6 rounded-2xl flex justify-between items-center bg-white/5 border border-white/5 h-16">
                    <span className="font-bold">{userSettings?.email}</span>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">VERIFICADO</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setCurrentSubView(null)} className="vision-btn px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] border border-white/10">Desativar Autenticação</button>
            </GlassPanel>
          </div>
        );
      case 'passkeys':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Chaves de Acesso</h2>
            </div>
            <div className="space-y-6">
              {[
                { name: 'Apple Vision Pro (Este aparelho)', date: 'Adicionado hoje', icon: 'M12 11c0 3.517-1.009 6.799-2.753 9.571' },
                { name: 'FaceID iPhone 15 Pro', date: 'Adicionado em 12/10/2024', icon: 'M12 11c0 3.517-1.009 6.799-2.753 9.571' }
              ].map((key, i) => (
                <GlassPanel key={i} className="p-8! rounded-[2.5rem]! border border-white/5 flex justify-between items-center group hover:border-white/20">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xl">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.268 0 2.39.606 3.107 1.554m-2.107 10.102V14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2h2.292" /></svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-black">{key.name}</h4>
                      <p className="text-xs text-white/30 font-light">{key.date}</p>
                    </div>
                  </div>
                  <button className="vision-btn w-10 h-10 rounded-full flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-600/10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </GlassPanel>
              ))}
              <button onClick={() => setCurrentSubView(null)} className="w-full py-8 rounded-4xl vision-btn border-dashed border-2 border-white/10 font-black text-xs uppercase tracking-[0.5em] text-white/20 hover:text-white hover:bg-white/5 transition-all">
                Adicionar nova Chave de Acesso
              </button>
            </div>
          </div>
        );
      case 'sign-out-all':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-5 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <button onClick={() => setCurrentSubView(null)} className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Sair de Tudo</h2>
            </div>
            <GlassPanel className="p-16! rounded-[4rem]! border border-red-600/30 bg-red-600/5 text-center space-y-12">
              <div className="w-32 h-32 rounded-full bg-red-600/20 flex items-center justify-center text-red-500 mx-auto shadow-[0_0_80px_rgba(255,0,0,0.3)] border border-red-600/30">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </div>
              <div className="max-w-xl mx-auto space-y-4">
                <h3 className="text-4xl font-black tracking-tighter">Tem certeza absoluta?</h3>
                <p className="text-xl text-white/60 font-light leading-relaxed">Isso encerrará sua sessão em todos os computadores, Smart TVs e computadores espaciais conectados à conta <span className="text-white font-bold">{userSettings?.email || 'fabricio@red-x.com'}</span>.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-6 justify-center pt-8">
                <button onClick={() => setCurrentSubView(null)} className="vision-btn px-16 py-6 rounded-3xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/15">CANCELAR</button>
                <button className="vision-btn px-16 py-6 rounded-3xl font-black text-xs uppercase tracking-widest bg-red-600 text-white shadow-[0_20px_60px_rgba(255,0,0,0.4)] hover:scale-110">SAIR DE TUDO AGORA</button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10 pt-4">AVISO: VOCÊ PRECISARÁ REAUTENTICAR TODOS OS SEUS DISPOSITIVOS VISION.</p>
            </GlassPanel>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen z-50 animate-in fade-in slide-in-from-bottom-5 duration-700 responsive-container pt-24 md:pt-40 pb-20 flex justify-center items-start">
      <div
        className="flex flex-col lg:flex-row gap-12 md:gap-20 items-start origin-top-center"
        style={{ transform: 'scale(0.6)' }}
      >
        {/* Sidebar Nav */}
        <aside className="lg:w-[320px] w-full" ref={sidebarRef}>
          <GlassPanel className="p-6! rounded-[3rem]! lg:sticky lg:top-40 border border-white/10 shadow-3xl">
            <button
              onClick={() => { playBackSound(); onBack(); }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playBackSound(); onBack(); } }}
              className="w-full flex items-center gap-5 px-6 py-5 rounded-4xl hover:bg-white/10 transition-all mb-10 group bg-white/5 border border-white/5 outline-none focus:ring-2 focus:ring-[#E50914]"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-600 transition-colors shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-white">Voltar à RED X</span>
            </button>

            <nav className="space-y-3">
              {menuItems.map((item, idx) => (
                <button
                  key={item.id}
                  data-settings-nav
                  tabIndex={0}
                  onClick={() => handleTabChange(item.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTabChange(item.id); } }}
                  className={`w-full flex items-center gap-5 px-6 py-5 rounded-4xl transition-all outline-none focus:ring-2 focus:ring-[#E50914] ${activeTab === item.id ? 'bg-white/20 text-white shadow-[0_15px_30px_rgba(0,0,0,0.3)] border border-white/20' : 'text-white/30 hover:bg-white/5 hover:text-white/60'}`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeTab === item.id ? 'bg-red-600 text-white shadow-xl' : 'bg-white/5'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                </button>
              ))}
            </nav>
          </GlassPanel>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-5xl">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Settings;

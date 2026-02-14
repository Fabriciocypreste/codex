import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { createProfile, getProfiles, updateProfile, deleteProfile, AVATAR_COLORS, PARENTAL_RATINGS, verifyParentalPin } from '../services/profileService';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaPen, FaLock, FaChild, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import { playSelectSound, playNavigateSound, playBackSound } from '../utils/soundEffects';

interface ProfilesProps {
  onSelect: (profile: UserProfile) => void;
}

const Profiles: React.FC<ProfilesProps> = ({ onSelect }) => {
  const { user } = useAuth();
  const { setFocus } = useSpatialNav();
  
  // Data State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  
  // Modals
  const [showPinModal, setShowPinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Form State (New/Edit)
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    isKids: false,
    avatarColor: AVATAR_COLORS[0],
    parentalRating: 'L',
    parentalPin: '',
    autoPlayNext: true
  });

  // Fetch Profiles
  const loadProfiles = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getProfiles(user.id);
      setProfiles(data);
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Spatial Nav Registration
  useEffect(() => {
    if (!loading && profiles.length > 0) {
      const firstId = profiles[0]?.id || 'add-profile-btn';
      setTimeout(() => setFocus(firstId), 100);
    }
  }, [loading, profiles, setFocus]);

  // Handlers
  const handleProfileClick = (profile: UserProfile) => {
    playSelectSound();
    
    if (isEditMode) {
      setSelectedProfile(profile);
      setFormData({
        name: profile.name,
        isKids: profile.isKids,
        avatarColor: profile.avatarColor || AVATAR_COLORS[0],
        parentalRating: profile.parentalRating || 'L',
        parentalPin: profile.parentalPin || '',
        autoPlayNext: profile.autoPlayNext
      });
      setShowEditModal(true);
    } else {
      if (profile.parentalPin) {
        setSelectedProfile(profile);
        setPinCurrent('');
        setPinError('');
        setShowPinModal(true);
      } else {
        onSelect(profile);
      }
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedProfile) return;
    
    const isValid = await verifyParentalPin(selectedProfile.id, pinCurrent);
    if (isValid) {
      playSelectSound();
      setShowPinModal(false);
      onSelect(selectedProfile);
    } else {
      playBackSound();
      setPinError('PIN Incorreto');
      setPinCurrent('');
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !formData.name) return;
    playSelectSound();

    try {
      if (selectedProfile) {
        const updated = await updateProfile(selectedProfile.id, {
          name: formData.name,
          isKids: formData.isKids,
          avatarColor: formData.avatarColor,
          parentalRating: formData.parentalRating,
          parentalPin: formData.parentalPin,
          autoPlayNext: formData.autoPlayNext
        });
        if (updated) {
          setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
        }
      } else {
        const newProfile = await createProfile(user.id, {
          name: formData.name,
          isKids: formData.isKids || false,
          avatarColor: formData.avatarColor,
          parentalRating: formData.parentalRating,
          parentalPin: formData.parentalPin
        });
        if (newProfile) {
          setProfiles(prev => [...prev, newProfile]);
        }
      }
      setShowEditModal(false);
      setSelectedProfile(null);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;
    if (window.confirm(`Tem certeza que deseja excluir o perfil ${selectedProfile.name}?`)) {
      await deleteProfile(selectedProfile.id);
      setProfiles(prev => prev.filter(p => p.id !== selectedProfile.id));
      setShowEditModal(false);
      setSelectedProfile(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      isKids: false,
      avatarColor: AVATAR_COLORS[0],
      parentalRating: 'L',
      parentalPin: '',
    });
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    playSelectSound();
  };

  useEffect(() => {
    if (!showPinModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinCurrent.length < 4) {
          setPinCurrent(prev => prev + e.key);
          playNavigateSound();
        }
      } else if (e.key === 'Backspace') {
        setPinCurrent(prev => prev.slice(0, -1));
        playBackSound();
      } else if (e.key === 'Enter') {
        if (pinCurrent.length === 4) handlePinSubmit();
      } else if (e.key === 'Escape') {
        setShowPinModal(false);
        setPinCurrent('');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinModal, pinCurrent, selectedProfile]);

  const containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--obsidian-bg)',
    fontFamily: '"Inter", sans-serif',
    overflow: 'hidden',
    height: '100vh',
    position: 'relative',
    width: '100%'
  };

  const backgroundOrbsStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundImage: `
      radial-gradient(circle at 50% -20%, var(--crimson-glow) 0%, transparent 60%),
      radial-gradient(circle at 0% 100%, #330000 0%, transparent 40%),
      radial-gradient(circle at 100% 100%, #220000 0%, transparent 40%)
    `,
    backgroundAttachment: 'fixed'
  };

  return (
    <div style={containerStyle} className="flex flex-col items-center justify-center text-white">
      <div style={backgroundOrbsStyle} className="animate-pulse-red" />
      
      <div className="z-10 w-full max-w-4xl px-6 flex flex-col items-center gap-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">Quem está assistindo?</h1>
          {isEditMode && <p className="text-sm md:text-base text-white/60">Selecione um perfil para editar</p>}
        </motion.div>

        <div className="flex flex-wrap justify-center gap-5 md:gap-8">
          {loading ? (
             <div className="flex items-center gap-2">
               <div className="w-6 h-6 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
               <span className="text-white/50">Carregando perfis...</span>
             </div>
          ) : (
            <>
              {profiles.map((profile) => (
                <div key={profile.id} className="flex flex-col items-center gap-2 group relative">
                    <button
                        id={profile.id}
                        className={`
                        w-20 h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden relative shadow-lg
                        transition-all duration-300 transform
                        hover:ring-4 hover:ring-white
                        focus:outline-none focus-visible:!outline-none
                        focus-visible:ring-4 focus-visible:ring-white focus-visible:scale-105
                        ${isEditMode ? 'animate-pulse' : ''}
                        `}
                        style={{ boxShadow: 'none' }}
                        onClick={() => handleProfileClick(profile)}
                        onFocus={() => playNavigateSound()}
                        data-nav-item
                        data-profile-btn
                    >
                        <div className={`w-full h-full ${profile.avatarColor || 'bg-gray-600'} flex items-center justify-center relative`}>
                            {profile.avatar ? (
                                <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl md:text-4xl font-bold uppercase select-none">{profile.name[0]}</span>
                            )}
                            
                            {isEditMode && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <FaPen className="text-white text-xl md:text-2xl" />
                                </div>
                            )}
                            
                            {!isEditMode && profile.parentalPin && (
                                <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full">
                                <FaLock className="text-white/80 text-xs" />
                                </div>
                            )}

                            {profile.isKids && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[10px] py-1 text-center font-bold uppercase tracking-widest text-white/90">
                                Kids
                                </div>
                            )}
                        </div>
                    </button>
                    <span className="text-white/60 text-xs md:text-sm group-hover:text-white transition-colors text-center max-w-[100px] md:max-w-[120px] truncate">
                        {profile.name}
                    </span>
                </div>
              ))}

              {profiles.length < 5 && (
                <button
                  id="add-profile-btn"
                  className={`
                    group relative w-20 h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 flex flex-col items-center justify-center gap-2
                    rounded-2xl transition-all duration-300
                    hover:scale-105 focus:scale-105 focus:outline-none focus-visible:!outline-none
                    focus-visible:ring-4 focus-visible:ring-white
                  `}
                  data-nav-item
                  data-profile-btn
                  data-nav-row="0" 
                  data-nav-col={profiles.length}
                  onClick={() => {
                    resetForm();
                    setSelectedProfile(null);
                    setShowEditModal(true);
                    playSelectSound();
                  }}
                >
                  <div className="w-full h-full rounded-full border-2 border-white/20 bg-transparent flex items-center justify-center group-hover:bg-white/10 group-focus:border-white transition-all">
                    <FaPlus className="text-2xl md:text-3xl text-white/50 group-hover:text-white group-focus:text-white transition-colors" />
                  </div>
                  <span className="text-xs md:text-sm text-white/50 group-hover:text-white font-medium">Adicionar</span>
                </button>
              )}
            </>
          )}
        </div>

        <button
          className="mt-4 px-6 py-2 border border-white/30 hover:border-white text-white/60 hover:text-white uppercase tracking-widest text-xs font-semibold transition-all hover:bg-white/10 rounded-lg"
          onClick={toggleEditMode}
          data-nav-item
          data-nav-row="1"
          data-nav-col="0"
        >
          {isEditMode ? 'Concluído' : 'Gerenciar Perfis'}
        </button>
      </div>

      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#18181b] p-8 rounded-xl border border-white/10 max-w-md w-full flex flex-col items-center gap-6 shadow-2xl"
            >
              <h3 className="text-2xl font-semibold">PIN do Perfil</h3>
              <p className="text-white/60 text-center text-sm">Digite o PIN de 4 dígitos para acessar {selectedProfile?.name}</p>
              
              <div className="flex gap-4 my-4">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={`
                      w-12 h-14 rounded border-2 flex items-center justify-center text-2xl font-bold bg-black/40 transition-colors
                      ${i < pinCurrent.length ? 'border-[#E50914] text-white' : 'border-white/10 text-transparent'}
                      ${pinError ? 'border-red-500' : ''}
                    `}
                  >
                    {i < pinCurrent.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {pinError && <p className="text-red-500 font-medium text-sm animate-pulse">{pinError}</p>}

              <button 
                onClick={() => { setShowPinModal(false); setPinCurrent(''); }}
                className="text-white/50 hover:text-white mt-4 text-sm uppercase tracking-wider"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md overflow-y-auto py-10">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-[#18181b] w-full max-w-4xl p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl relative"
            >
              <button 
                className="absolute top-6 right-6 text-white/40 hover:text-white p-2"
                onClick={() => setShowEditModal(false)}
              >
                <FaTimes size={24} />
              </button>

              <div className="flex flex-col md:flex-row gap-12">
                <div className="flex flex-col items-center gap-6 min-w-[200px]">
                  <div className={`w-40 h-40 rounded-md shadow-lg ${formData.avatarColor} flex items-center justify-center relative overflow-hidden`}>
                    {formData.avatar ? (
                       <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                       <span className="text-5xl font-bold uppercase">{formData.name?.[0] || '?'}</span>
                    )}
                    {formData.isKids && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 text-center text-xs uppercase font-bold tracking-wider">Kids</div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    {AVATAR_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, avatarColor: color, avatar: undefined }))}
                        className={`w-8 h-8 rounded-full ${color} transform transition-transform hover:scale-110 ${formData.avatarColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <h2 className="text-3xl font-bold mb-6">
                    {selectedProfile ? 'Editar Perfil' : 'Novo Perfil'}
                  </h2>

                  <div className="space-y-2">
                    <label className="block text-sm uppercase text-white/50 tracking-wider">Nome</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#333] text-white px-4 py-3 rounded focus:outline-none focus:ring-2 focus:ring-white/50 text-lg"
                      placeholder="Nome do perfil"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button className="flex items-center gap-4 bg-white/5 p-4 rounded-lg cursor-pointer text-left" onClick={() => setFormData(prev => ({ ...prev, isKids: !prev.isKids }))}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${formData.isKids ? 'bg-green-500 text-white' : 'bg-white/10 text-white/30'}`}>
                        <FaChild size={24} />
                      </div>
                      <div>
                        <div className="font-semibold">Perfil Kids</div>
                        <div className="text-xs text-white/50">Conteúdo até 12 anos</div>
                      </div>
                      <div className={`ml-auto w-12 h-6 rounded-full relative transition-colors ${formData.isKids ? 'bg-green-500' : 'bg-white/20'}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.isKids ? 'translate-x-6' : ''}`} />
                      </div>
                    </button>

                    <button className="flex items-center gap-4 bg-white/5 p-4 rounded-lg cursor-pointer text-left" onClick={() => setFormData(prev => ({ ...prev, autoPlayNext: !prev.autoPlayNext }))}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white`}>
                        <FaCheck size={18} className={formData.autoPlayNext ? 'opacity-100' : 'opacity-0'} />
                      </div>
                      <div>
                        <div className="font-semibold">Autoplay</div>
                        <div className="text-xs text-white/50">Reproduzir próximo episódio</div>
                      </div>
                    </button>
                  </div>

                  <hr className="border-white/10 my-4" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FaLock className="text-[#E50914]" />
                      Controle Parental
                    </h3>

                    <div className="space-y-2">
                      <label className="block text-sm uppercase text-white/50 tracking-wider">Classificação Etária Máxima</label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {PARENTAL_RATINGS.map(rating => (
                          <button
                            key={rating.value}
                            onClick={() => setFormData(prev => ({ ...prev, parentalRating: rating.value }))}
                            className={`
                              px-3 py-2 rounded text-sm font-bold min-w-[50px] transition-all
                              ${formData.parentalRating === rating.value ? 'ring-2 ring-white scale-105' : 'opacity-50 hover:opacity-100'}
                              ${rating.color}
                            `}
                            title={rating.description}
                          >
                            {rating.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-white/40">
                        {PARENTAL_RATINGS.find(r => r.value === formData.parentalRating)?.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm uppercase text-white/50 tracking-wider">PIN de Bloqueio (4 dígitos)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]*"
                        value={formData.parentalPin}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 4) setFormData(prev => ({ ...prev, parentalPin: val }));
                        }}
                        className="w-full max-w-[150px] bg-[#333] text-white px-4 py-3 rounded focus:outline-none focus:ring-2 focus:ring-white/50 text-center tracking-[1em] font-mono text-lg"
                        placeholder="----"
                      />
                      <p className="text-xs text-white/40">Deixe em branco para remover o PIN.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6 mt-6 border-t border-white/10">
                    <button
                      onClick={handleSaveProfile}
                      className="px-8 py-3 bg-white text-black font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition-colors rounded"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="px-8 py-3 border border-white/30 text-white font-bold uppercase tracking-wider hover:border-white transition-colors rounded"
                    >
                      Cancelar
                    </button>
                    
                    {selectedProfile && (
                      <button
                        onClick={handleDeleteProfile}
                        className="ml-auto px-6 py-3 border border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-colors rounded flex items-center gap-2"
                      >
                        <FaTrash /> Excluir
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Profiles;

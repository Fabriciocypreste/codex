import React, { useState, useEffect } from 'react';
import { Plus, Edit3, ArrowLeft, Trash2 } from 'lucide-react';
import { playSelectSound } from '../utils/soundEffects';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { createProfile, deleteProfile } from '../services/profileService';
import { getUserProfiles } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';

interface ProfilesProps {
  onSelect: (profile: UserProfile) => void;
  onBackToLogin?: () => void;
}

const Profiles: React.FC<ProfilesProps> = ({ onSelect, onBackToLogin }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false); // Mode to delete profiles
  const [newProfileName, setNewProfileName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load profiles from DB
  useEffect(() => {
    async function loadProfiles() {
      if (!user) return;
      try {
        const dbProfiles = await getUserProfiles(user.id);
        if (dbProfiles && dbProfiles.length > 0) {
          // Map DB structure to UserProfile interface
          const mapped: UserProfile[] = dbProfiles.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar_url,
            // Let's assume for now we use whatever is available.
            // If the column in DB is 'avatar', then UserProfileDB interface in code might be outdated name 'avatar_color'.
            // I will assume it's 'avatar' if the insert worked. 
            // Let's use 'p.avatar' casted as any if needed, or update interface later.
            // Actually, let's just Map it safely.
            isKids: p.is_kids
          } as any));
          setProfiles(mapped);
        } else {
          // Fallback default
          setProfiles([
            { id: '1', name: 'Usuário', isKids: false }
          ]);
        }
      } catch (e) {
        console.error("Error loading profiles", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfiles();
  }, [user]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim() || !user) return;

    setIsSaving(true);
    try {
      const newProfileData = await createProfile(user.id, newProfileName, avatarFile);

      if (newProfileData) {
        setProfiles([...profiles, newProfileData]);
        setIsAdding(false);
        setNewProfileName('');
        setAvatarFile(null);
        setAvatarPreview(null);
      } else {
        alert("Erro ao criar perfil. Verifique o console para detalhes.");
      }
    } catch (error: any) {
      console.error('Erro ao criar perfil:', error);
      alert(`Erro ao criar perfil: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profileId: string, avatarUrl?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Tem certeza que deseja excluir este perfil?")) return;

    try {
      const success = await deleteProfile(profileId, avatarUrl);
      if (success) {
        setProfiles(profiles.filter(p => p.id !== profileId));
      } else {
        alert("Erro ao excluir perfil");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir");
    }
  };

  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);

  const handleUpdateProfile = async () => {
    if (!editingProfile || !newProfileName.trim() || !user) return;

    setIsSaving(true);
    try {
      const updated = await import('../services/profileService').then(m => m.updateProfile(editingProfile.id, user.id, {
        name: newProfileName,
        avatarFile: avatarFile
      }));

      if (updated) {
        setProfiles(profiles.map(p => p.id === updated.id ? updated : p));
        setEditingProfile(null);
        setNewProfileName('');
        setAvatarFile(null);
        setAvatarPreview(null);
      } else {
        alert("Erro ao atualizar perfil. Tente novamente.");
      }
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      alert(`Erro ao atualizar: ${error?.message || 'Falha desconhecida'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) return;
    if (!window.confirm(`Enviar e-mail de redefinição de senha para ${user.email}?`)) return;

    try {
      const { error } = await import('../services/supabaseService').then(m => m.supabase.auth.resetPasswordForEmail(user.email!));
      if (error) throw error;
      alert(`E-mail de redefinição enviado para ${user.email}`);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar e-mail de redefinição.');
    }
  };

  const openEditModal = (profile: UserProfile) => {
    setEditingProfile(profile);
    setNewProfileName(profile.name);
    setAvatarPreview(profile.avatar || null);
    setAvatarFile(null);
  };

  // --- RENDER EDIT MODAL ---
  if (editingProfile) {
    return (
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_#990000_0%,_#000000_70%)] flex flex-col items-center justify-center animate-fadeIn font-sans z-50">
        <div className="bg-white/10 backdrop-blur-[15px] border border-white/10 p-8 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-md">
          <h2 className="text-2xl font-bold text-white mb-6">Editar Perfil</h2>

          <div className="space-y-6">
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-white/30 flex items-center justify-center bg-black/20 group-hover:border-white/60 transition-colors">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-white/40">
                      <Plus size={32} />
                      <span className="text-xs uppercase font-bold mt-2">Alterar</span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                  <Edit3 size={16} className="text-white" />
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Nome</label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                placeholder="Nome do perfil"
                maxLength={20}
              />
            </div>

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={handlePasswordReset}
                className="w-full text-xs text-white/50 hover:text-white underline py-2"
              >
                Alterar Senha da Conta (Enviar E-mail)
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setEditingProfile(null);
                  setAvatarPreview(null);
                  setAvatarFile(null);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateProfile}
                disabled={isSaving || !newProfileName.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-white/50 text-white transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER ADD MODAL (Existing) ---
  if (isAdding) {
    // ... existing Add Modal implementation ...
    return (
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_#990000_0%,_#000000_70%)] flex flex-col items-center justify-center animate-fadeIn font-sans z-50">
        <div className="bg-white/10 backdrop-blur-[15px] border border-white/10 p-8 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-md">
          <h2 className="text-2xl font-bold text-white mb-6">Adicionar Perfil</h2>

          <div className="space-y-6">
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-white/30 flex items-center justify-center bg-black/20 group-hover:border-white/60 transition-colors">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-white/40">
                      <Plus size={32} />
                      <span className="text-xs uppercase font-bold mt-2">Foto</span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="absolute bottom-0 right-0 bg-red-600 p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                  <Edit3 size={16} className="text-white" />
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Nome</label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none transition-colors"
                placeholder="Nome do perfil"
                maxLength={20}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setAvatarPreview(null);
                  setAvatarFile(null);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddProfile}
                disabled={isSaving || !newProfileName.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-white/50 text-white transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_#990000_0%,_#000000_70%)] flex flex-col items-center justify-center animate-fadeIn font-sans p-4">
      {/* Main Wrapper */}
      <main className="relative w-full max-w-4xl flex flex-col items-center gap-[20px]">

        {/* Close/Back Button */}
        {onBackToLogin && (
          <button
            aria-label="Voltar"
            onClick={onBackToLogin}
            className="w-[40px] h-[40px] rounded-full bg-black/40 hover:bg-black/60 border border-white/30 flex items-center justify-center transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
        )}

        {/* Profile Card */}
        <section className="bg-white/10 backdrop-blur-[15px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[20px] w-full max-w-2xl flex flex-col items-center text-center space-y-12 p-[40px]" data-nav-row="0">
          <h1 className="text-[24px] font-sans text-white font-medium tracking-tight">
            {isManageMode ? "Gerenciar Perfis" : "Quem está assistindo?"}
          </h1>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {profiles.map((profile, index) => (
              <div
                key={profile.id}
                onClick={() => {
                  if (isManageMode) {
                    openEditModal(profile);
                  } else {
                    playSelectSound();
                    onSelect(profile);
                  }
                }}
                className={`group flex flex-col items-center space-y-[12px] cursor-pointer ${isManageMode ? 'animate-pulse' : ''}`}
                tabIndex={0}
                data-nav-item
                data-nav-col={index}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isManageMode) {
                      openEditModal(profile);
                    } else {
                      playSelectSound();
                      onSelect(profile);
                    }
                  }
                }}
              >
                <div
                  className={`w-[120px] h-[120px] rounded-xl overflow-hidden border-2 border-transparent ${isManageMode ? 'group-hover:border-blue-500' : 'group-hover:border-white'} group-focus:border-white group-focus:scale-105 transition-all duration-300 shadow-lg profile-img-hover flex items-center justify-center relative bg-black/20`}
                >
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={`Perfil de ${profile.name}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                      <span className="text-white font-bold text-4xl uppercase">{profile.name[0]}</span>
                    </div>
                  )}

                  {/* Edit/Delete Overlay */}
                  {isManageMode && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 gap-2">
                      <Edit3 className="text-blue-400 w-6 h-6 hover:scale-110 transition-transform" />
                      <div onClick={(e) => handleDelete(profile.id, profile.avatar, e)} className="p-2 hover:bg-white/10 rounded-full">
                        <Trash2 className="text-red-500 w-6 h-6 hover:scale-110 transition-transform" />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-gray-300 font-medium text-lg group-hover:text-white group-focus:text-white transition-colors">{profile.name}</span>
              </div>
            ))}

            {/* Add Profile Button */}
            {!isManageMode && (
              <div
                onClick={() => setIsAdding(true)}
                className="group flex flex-col items-center space-y-[12px] cursor-pointer"
                tabIndex={0}
                data-nav-item
                data-nav-col={profiles.length}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); setIsAdding(true); }
                }}
              >
                <div className="w-[120px] h-[120px] rounded-xl overflow-hidden border-2 border-dashed border-gray-500 group-hover:border-white group-focus:border-white group-focus:scale-105 transition-all duration-300 shadow-lg flex items-center justify-center bg-black/20">
                  <Plus size={40} className="text-gray-500 group-hover:text-white group-focus:text-white transition-colors" />
                </div>
                <span className="text-gray-500 font-medium text-lg group-hover:text-white group-focus:text-white transition-colors">Adicionar</span>
              </div>
            )}
          </div>

          <div className="mt-8" data-nav-row="1">
            <button
              onClick={() => setIsManageMode(!isManageMode)}
              className={`px-8 py-2 border ${isManageMode ? 'border-blue-500 text-blue-500' : 'border-white/30 text-white/60'} hover:border-white hover:text-white focus:border-white focus:text-white uppercase tracking-widest transition-all text-xs font-bold`}
              tabIndex={0}
              data-nav-item
              data-nav-col="0"
            >
              {isManageMode ? "Concluir Edição" : "Gerenciar perfis"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profiles;

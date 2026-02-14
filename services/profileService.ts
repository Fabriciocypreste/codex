import { supabase } from './supabaseService';
import { UserProfile } from '../types';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

// Cores de avatar predefinidas
export const AVATAR_COLORS = [
  'bg-red-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-yellow-500',
  'bg-pink-600',
  'bg-cyan-500',
  'bg-orange-500',
];

// Classificações etárias brasileiras
export const PARENTAL_RATINGS = [
  { label: 'L', value: 'L', level: 0, color: 'bg-green-500', description: 'Livre para todas as idades' },
  { label: '10+', value: '10+', level: 10, color: 'bg-blue-500', description: 'Não recomendado para menores de 10 anos' },
  { label: '12+', value: '12+', level: 12, color: 'bg-yellow-500', description: 'Não recomendado para menores de 12 anos' },
  { label: '14+', value: '14+', level: 14, color: 'bg-orange-500', description: 'Não recomendado para menores de 14 anos' },
  { label: '16+', value: '16+', level: 16, color: 'bg-red-500', description: 'Não recomendado para menores de 16 anos' },
  { label: '18+', value: '18+', level: 18, color: 'bg-red-800', description: 'Não recomendado para menores de 18 anos' },
];

// Mapear dados do DB para UserProfile
export const mapDBToProfile = (data: any): UserProfile => ({
  id: data.id,
  name: data.name,
  avatar: data.avatar_url || undefined,
  avatarColor: data.avatar_color || 'bg-blue-600',
  isKids: data.is_kids || false,
  language: 'pt-BR',
  parentalRating: data.parental_rating || '18+',
  parentalPin: data.parental_pin || '',
  parentalEnabled: data.parental_enabled || false,
  maturityLevel: data.maturity_level ?? 18,
  autoPlayNext: true,
});

export const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    console.error(`[uploadAvatar] Tipo não permitido: ${file.type}`);
    return null;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    console.error(`[uploadAvatar] Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    return null;
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    let { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError && (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket') || (uploadError as any).statusCode === 404)) {
      const { error: createError } = await supabase.storage.createBucket('avatars', { public: true, fileSizeLimit: 5242880 });
      if (createError && !createError.message?.includes('already exists')) {
        const fallbackName = `avatars_${fileName}`;
        const { error: fallbackError } = await supabase.storage.from('posters').upload(fallbackName, file, { upsert: true });
        if (fallbackError) return null;
        const { data } = supabase.storage.from('posters').getPublicUrl(fallbackName);
        return data.publicUrl;
      }
      const retry = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      uploadError = retry.error;
    }

    if (uploadError) return null;

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
};

// Recuperar perfis do usuário
export const getProfiles = async (userId: string): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar perfis:', error);
      return [];
    }

    return (data || []).map(mapDBToProfile);
  } catch (error) {
    console.error('Erro inesperado ao buscar perfis:', error);
    return [];
  }
};

export const createProfile = async (
  userId: string,
  data: {
    name: string;
    isKids?: boolean;
    avatarColor?: string;
    parentalRating?: string;
    parentalPin?: string;
    parentalEnabled?: boolean;
    maturityLevel?: number;
    avatarFile?: File | null;
  }
): Promise<UserProfile | null> => {
  try {
    let avatarUrl = null;
    if (data.avatarFile) {
      avatarUrl = await uploadAvatar(data.avatarFile, userId);
    }

    const isKids = data.isKids || false;
    const newProfile: any = {
      user_id: userId,
      name: data.name,
      avatar_url: avatarUrl,
      avatar_color: data.avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      is_kids: isKids,
      parental_rating: data.parentalRating || (isKids ? 'L' : '18+'),
      parental_pin: data.parentalPin || '',
      parental_enabled: !!data.parentalPin || isKids,
      maturity_level: data.maturityLevel ?? (isKids ? 0 : 18),
    };

    const { data: inserted, error } = await supabase
      .from('user_profiles')
      .insert([newProfile])
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar perfil: ${error.message}`);
    return mapDBToProfile(inserted);
  } catch (error) {
    console.error('Erro no serviço de perfil:', error);
    throw error;
  }
};

export const deleteProfile = async (profileId: string, avatarUrl?: string): Promise<boolean> => {
  try {
    if (avatarUrl) {
      const pathParts = avatarUrl.split('/avatars/');
      if (pathParts.length > 1) {
        await supabase.storage.from('avatars').remove([pathParts[1]]);
      }
    }

    const { error } = await supabase.from('user_profiles').delete().eq('id', profileId);
    if (error) {
      console.error('Erro ao deletar perfil:', error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const updateProfile = async (
  profileId: string,
  userId: string,
  updates: {
    name?: string;
    avatarFile?: File | null;
    isKids?: boolean;
    avatarColor?: string;
    parentalRating?: string;
    parentalPin?: string;
    parentalEnabled?: boolean;
    maturityLevel?: number;
  }
): Promise<UserProfile | null> => {
  try {
    const payload: any = {};

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.isKids !== undefined) payload.is_kids = updates.isKids;
    if (updates.avatarColor !== undefined) payload.avatar_color = updates.avatarColor;
    if (updates.parentalRating !== undefined) payload.parental_rating = updates.parentalRating;
    if (updates.parentalPin !== undefined) payload.parental_pin = updates.parentalPin;
    if (updates.parentalEnabled !== undefined) payload.parental_enabled = updates.parentalEnabled;
    if (updates.maturityLevel !== undefined) payload.maturity_level = updates.maturityLevel;

    if (updates.avatarFile) {
      const uploadedUrl = await uploadAvatar(updates.avatarFile, userId);
      if (uploadedUrl) payload.avatar_url = uploadedUrl;
    }

    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', profileId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
    return mapDBToProfile(data);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    throw error;
  }
};

// Verificar PIN de controle parental
export const verifyParentalPin = (profile: UserProfile, inputPin: string): boolean => {
  if (!profile.parentalEnabled || !profile.parentalPin) return true;
  return profile.parentalPin === inputPin;
};

// Salvar/Ler PIN do localStorage (fallback)
export const saveParentalPinLocal = (profileId: string, pin: string) => {
  try {
    const pins = JSON.parse(localStorage.getItem('redx_parental_pins') || '{}');
    pins[profileId] = pin;
    localStorage.setItem('redx_parental_pins', JSON.stringify(pins));
  } catch { /* ignorar */ }
};

export const getParentalPinLocal = (profileId: string): string => {
  try {
    const pins = JSON.parse(localStorage.getItem('redx_parental_pins') || '{}');
    return pins[profileId] || '';
  } catch { return ''; }
};

// Verificar se perfil pode acessar conteúdo baseado na classificação
export const canAccessContent = (profile: UserProfile, contentRating: string | number = 0): boolean => {
  // 1. Obter nível numérico do conteúdo
  let contentLevel = 0;
  
  if (typeof contentRating === 'number') {
    contentLevel = contentRating;
  } else {
    // Parsing básico de string para número
    const r = String(contentRating).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (['L', 'G', '0', 'SC', 'TVY', 'TVG'].includes(r)) contentLevel = 0;
    else if (r.includes('10') || r.includes('PG')) contentLevel = 10;
    else if (r.includes('12') || r.includes('PG13')) contentLevel = 12;
    else if (r.includes('14')) contentLevel = 14;
    else if (r.includes('16')) contentLevel = 16;
    else if (r.includes('18') || r.includes('TVMA') || r.includes('R')) contentLevel = 18;
    else contentLevel = 0; // Default seguro
  }

  // 2. Obter nível permitido do perfil
  // Se não tiver rating definido, assume 18 (liberado)
  const profileRatingObj = PARENTAL_RATINGS.find(pr => pr.value === profile.parentalRating);
  const profileLevel = profileRatingObj ? profileRatingObj.level : 18;

  // 3. Comparar
  return contentLevel <= profileLevel;
};



import { supabase } from './supabaseService';
import { UserProfile } from '../types';

export const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        // Upload para o bucket 'avatars'
        let { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        // Se o bucket não existir, tenta criar e fazer upload novamente
        if (uploadError && (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket') || (uploadError as any).statusCode === 404)) {
            console.warn('Bucket avatars não encontrado, tentando criar...');
            const { error: createError } = await supabase.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: 5242880 // 5MB
            });
            if (createError && !createError.message?.includes('already exists')) {
                console.error('Erro ao criar bucket avatars:', createError);
                // Fallback: usar bucket 'posters' que já existe
                const fallbackName = `avatars_${fileName}`;
                const { error: fallbackError } = await supabase.storage
                    .from('posters')
                    .upload(fallbackName, file, { upsert: true });
                if (fallbackError) {
                    console.error('Erro no fallback upload:', fallbackError);
                    return null;
                }
                const { data } = supabase.storage.from('posters').getPublicUrl(fallbackName);
                return data.publicUrl;
            }
            // Retry upload
            const retry = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });
            uploadError = retry.error;
        }

        if (uploadError) {
            console.error('Erro no upload:', uploadError);
            return null;
        }

        // Gerar URL pública
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (error) {
        console.error('Erro inesperado no upload:', error);
        return null;
    }
};

export const createProfile = async (
    userId: string,
    name: string,
    avatarFile: File | null
): Promise<UserProfile | null> => {
    try {
        let avatarUrl = null;

        if (avatarFile) {
            avatarUrl = await uploadAvatar(avatarFile, userId);
            if (!avatarUrl) {
                console.warn('Upload de avatar falhou, criando perfil sem foto.');
            }
        }

        const newProfile = {
            user_id: userId,
            name: name,
            avatar_url: avatarUrl,
            is_kids: false
        };

        const { data, error } = await supabase
            .from('user_profiles')
            .insert([newProfile])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar perfil no DB:', error);
            throw new Error(`Erro ao salvar perfil: ${error.message}`);
        }

        return {
            id: data.id,
            name: data.name,
            avatar: data.avatar_url,
            isKids: data.is_kids,
            language: 'pt-BR'
        };
    } catch (error) {
        console.error('Erro no serviço de perfil:', error);
        throw error;
    }
};

export const deleteProfile = async (profileId: string, avatarUrl?: string): Promise<boolean> => {
    try {
        // 1. Delete avatar if exists
        if (avatarUrl) {
            const fileName = avatarUrl.split('/').pop(); // Simple extraction, might need more robust logic if path is complex
            // Better: extract path after 'avatars/'
            const pathParts = avatarUrl.split('/avatars/');
            if (pathParts.length > 1) {
                const filePath = pathParts[1];
                const { error: storageError } = await supabase.storage
                    .from('avatars')
                    .remove([filePath]);
                if (storageError) console.warn('Erro ao deletar avatar:', storageError);
            }
        }

        // 2. Delete profile from DB
        // NOTE: Checking if table is 'profiles' or 'user_profiles'. Based on supabaseService, it is 'user_profiles'.
        // However, this file was using 'profiles'. I will change it to 'user_profiles' to match the known working service.
        const { error } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', profileId);

        if (error) {
            console.error('Erro ao deletar perfil:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erro ao deletar perfil:', error);
        return false;
    }
};

export const updateProfile = async (
    profileId: string,
    userId: string,
    updates: { name?: string; avatarFile?: File | null }
): Promise<UserProfile | null> => {
    try {
        const payload: any = {};

        if (updates.name) {
            payload.name = updates.name;
        }

        if (updates.avatarFile) {
            const uploadedUrl = await uploadAvatar(updates.avatarFile, userId);
            if (uploadedUrl) {
                payload.avatar_url = uploadedUrl;
            } else {
                console.warn('Falha no upload do avatar durante atualização, mantendo anterior.');
            }
        }

        if (Object.keys(payload).length === 0) {
            console.warn('Nenhum dado para atualizar.');
            return null;
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .update(payload)
            .eq('id', profileId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar perfil no DB:', error);
            throw new Error(`Erro ao atualizar: ${error.message}`);
        }

        return {
            id: data.id,
            name: data.name,
            avatar: data.avatar_url,
            isKids: data.is_kids,
            language: 'pt-BR'
        };
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
    }
};

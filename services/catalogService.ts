
import { supabase } from './supabaseService';

export interface CatalogSettings {
    id: number;
    min_year: number;
    max_year: number;
    selected_genres: string[];
    content_type: 'movies' | 'series' | 'mixed';
    updated_at?: string;
}

export const getCatalogSettings = async (): Promise<CatalogSettings | null> => {
    const { data, error } = await supabase
        .from('catalog_settings')
        .select('*')
        .single();

    if (error) {
        console.error('Error fetching catalog settings:', error);
        return null;
    }
    return data;
};

export const updateCatalogSettings = async (settings: Partial<CatalogSettings>) => {
    const { data, error } = await supabase
        .from('catalog_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single();

    if (error) {
        console.error('Error updating catalog settings:', error);
        throw error;
    }
    return data;
};

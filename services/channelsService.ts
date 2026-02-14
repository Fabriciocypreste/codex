import { Channel } from '../types';
import { getAllChannels } from './supabaseService';

const CANAIS_JSON_URL = '/canais.json';

let cachedChannels: Channel[] = [];

export const channelsService = {
    loadChannels: async (): Promise<Channel[]> => {
        if (cachedChannels.length > 0) return cachedChannels;

        try {
            const data = await getAllChannels();

            const allChannels: Channel[] = data.map((c) => ({
                id: c.id,
                nome: c.nome,
                logo: c.logo || '',
                genero: c.genero || 'Geral',
                url: c.url,
            }));

            cachedChannels = allChannels;
            return cachedChannels;
        } catch (error) {
            console.error('Error loading channels from database:', error);
            return [];
        }
    },

    getCategories: async (): Promise<string[]> => {
        const channels = await channelsService.loadChannels();
        const categories = Array.from(new Set(channels.map((c) => c.genero)));
        return categories.sort();
    },

    getChannelsByCategory: async (category: string): Promise<Channel[]> => {
        const channels = await channelsService.loadChannels();
        return channels.filter((c) => c.genero === category);
    },

    searchChannels: async (query: string): Promise<Channel[]> => {
        const channels = await channelsService.loadChannels();
        const lowerQuery = query.toLowerCase();
        return channels.filter((c) => c.nome.toLowerCase().includes(lowerQuery));
    }
};

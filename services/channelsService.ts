import { Channel } from '../types';
import { getAllChannels } from './supabaseService';

let cachedChannels: Channel[] = [];

export const channelsService = {
    loadChannels: async (): Promise<Channel[]> => {
        if (cachedChannels.length > 0) return cachedChannels;

        try {
            const data = await getAllChannels();

            const allChannels: Channel[] = data.map((c: any) => ({
                id: c.id,
                name: c.name || c.nome || '',
                logo: c.logo || c.logo_url || '',
                category: c.category || c.genero || 'Geral',
                stream_url: c.stream_url || c.url || '',
                number: c.number,
                is_premium: c.is_premium,
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
        const categories = Array.from(new Set(channels.map((c) => c.category)));
        return categories.sort();
    },

    getChannelsByCategory: async (category: string): Promise<Channel[]> => {
        const channels = await channelsService.loadChannels();
        return channels.filter((c) => c.category === category);
    },

    searchChannels: async (query: string): Promise<Channel[]> => {
        const channels = await channelsService.loadChannels();
        const lowerQuery = query.toLowerCase();
        return channels.filter((c) => c.name.toLowerCase().includes(lowerQuery));
    }
};

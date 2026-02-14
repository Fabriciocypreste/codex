import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAppConfig, AppConfig } from '../services/supabaseService';

interface ConfigContextType {
    config: AppConfig;
    updateConfig: (newConfig: Partial<AppConfig>) => void;
    isLoading: boolean;
}

const defaultConfig: AppConfig = {
    id: 'default',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    primary_color: '#E50914',
    secondary_color: '#ffffff',
    background_color: '#0a0a0a'
};

const ConfigContext = createContext<ConfigContextType>({
    config: defaultConfig,
    updateConfig: () => {},
    isLoading: true
});

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await getAppConfig();
            if (data) {
                setConfig(data);
                applyTheme(data);
            }
        } catch (error) {
            console.error('Erro ao carregar config:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateConfigLocal = (newConfig: Partial<AppConfig>) => {
        const updated = { ...config, ...newConfig };
        setConfig(updated);
        applyTheme(updated);
    };

    const applyTheme = (cfg: AppConfig) => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', cfg.primary_color);
        root.style.setProperty('--background-color', cfg.background_color);
        // Podemos adicionar mais variáveis CSS aqui se necessário
    };

    return (
        <ConfigContext.Provider value={{ config, updateConfig: updateConfigLocal, isLoading }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);

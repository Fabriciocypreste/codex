import React, { useState } from 'react';
import { playSelectSound } from '../utils/soundEffects';

export const platforms = [
    { name: 'Netflix', id: 8, logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg' },
    { name: 'Prime Video', id: 119, logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg' },
    { name: 'Disney+', id: 337, logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
    { name: 'Max', id: 1899, logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg' },
    { name: 'Globoplay', id: 307, logo: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Globoplay_2018.svg' },
    { name: 'Apple TV+', id: 350, logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg' },
    { name: 'Paramount+', id: 531, logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg' },
    { name: 'HBO Max', id: 384, logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg' },
    { name: 'Pluto TV', id: 300, logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Pluto_TV_logo_2024.svg' },
    { name: 'Crunchyroll', id: 283, logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.png' },
    { name: 'Claro Video', id: 167, logo: 'https://www.clarotvmais.com.br/campanhas/appclarotvmais/assets/images/logo-claro-tv-white.svg' },
    { name: 'Warner Bros', id: null, logo: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Warner_Bros_logo.svg' },
];

interface StreamingPlatformsProps {
    onSelectPlatform?: (platformName: string) => void;
}

const StreamingPlatforms: React.FC<StreamingPlatformsProps> = ({ onSelectPlatform }) => {
    const [paused, setPaused] = useState(false);
    // Triplicar para loop visual contínuo
    const tripled = [...platforms, ...platforms, ...platforms];

    return (
        <div className="relative z-20 py-2 overflow-hidden flex items-center justify-center w-full -mt-2">
            {/* Sem faixa de fundo para aproximar mais */}

            <div className="relative w-full flex items-center justify-center">
                {/* Gradientes nas bordas */}
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-linear-to-r from-[#0B0B0F] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-linear-to-l from-[#0B0B0F] to-transparent z-10 pointer-events-none" />

                {/* Carrossel Infinito — CSS only */}
                <div className={`platform-track flex gap-8 ${paused ? 'platform-paused' : ''}`} data-nav-row={2}>
                    {tripled.map((platform, index) => (
                        <div
                            key={`${platform.name}-${index}`}
                            onClick={() => { playSelectSound(); onSelectPlatform?.(platform.name); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onSelectPlatform?.(platform.name); } }}
                            onFocus={() => setPaused(true)}
                            onBlur={() => setPaused(false)}
                            tabIndex={0}
                            role="button"
                            data-nav-item
                            data-nav-col={index}
                            className="shrink-0 w-24 h-12 glass rounded-xl flex items-center justify-center p-3 border border-white/5 transition-transform duration-200 hover:scale-110 hover:border-[#E50914]/40 hover:shadow-lg hover:shadow-[#E50914]/20 cursor-pointer group/item focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                        >
                            <img
                                src={platform.logo}
                                alt={platform.name}
                                loading="lazy"
                                className="w-full h-full object-contain filter brightness-0 invert opacity-40 group-hover/item:opacity-100 transition-opacity duration-300"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .platform-track {
          animation: scroll 40s linear infinite;
        }
        .platform-track:hover,
        .platform-track:focus-within,
        .platform-paused {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
};

export default StreamingPlatforms;

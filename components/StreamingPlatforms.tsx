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
        <div className="relative z-20 py-4 overflow-hidden flex items-center justify-center w-full">
            {/* Faixa visionOS glass centralizada */}
            <div className="relative w-full max-w-[90%] mx-auto flex items-center justify-center">
                {/* Container glass visionOS */}
                <div className="relative w-full rounded-2xl overflow-hidden"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.04) 100%)',
                       backdropFilter: 'blur(40px) saturate(180%)',
                       WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                       border: '1px solid rgba(255,255,255,0.08)',
                       boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                     }}
                >
                    {/* Brilho sutil no topo (efeito visionOS) */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

                    {/* Gradientes de fade nas bordas */}
                    <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
                         style={{ background: 'linear-gradient(to right, rgba(11,11,15,0.95), transparent)' }} />
                    <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
                         style={{ background: 'linear-gradient(to left, rgba(11,11,15,0.95), transparent)' }} />

                    {/* Carrossel Infinito */}
                    <div className={`platform-track flex gap-5 py-3 px-6 ${paused ? 'platform-paused' : ''}`} data-nav-row={2}>
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
                                className="shrink-0 w-28 h-14 rounded-xl flex items-center justify-center p-3.5
                                  cursor-pointer group/item focus:outline-none
                                  transition-all duration-300 ease-out
                                  hover:scale-110 focus-visible:scale-110
                                  focus-visible:ring-2 focus-visible:ring-white/60"
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  borderRadius: '14px',
                                  transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                                }}
                                onMouseEnter={(e) => {
                                  const el = e.currentTarget;
                                  el.style.background = 'rgba(255,255,255,0.12)';
                                  el.style.border = '1px solid rgba(255,255,255,0.18)';
                                  el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  const el = e.currentTarget;
                                  el.style.background = 'rgba(255,255,255,0.04)';
                                  el.style.border = '1px solid rgba(255,255,255,0.06)';
                                  el.style.boxShadow = 'none';
                                }}
                            >
                                <img
                                    src={platform.logo}
                                    alt={platform.name}
                                    loading="lazy"
                                    className="w-full h-full object-contain filter brightness-0 invert opacity-50 group-hover/item:opacity-100 group-focus-visible/item:opacity-100 transition-opacity duration-300"
                                />
                            </div>
                        ))}
                    </div>
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

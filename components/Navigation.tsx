import React from 'react';
import { Page, UserProfile } from '../types';
import { Search } from 'lucide-react';
import { playSelectSound } from '../utils/soundEffects';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  profile: UserProfile | null;
  onProfileClick: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, profile, onProfileClick }) => {
  const navItems = [
    { id: Page.HOME, label: 'Início' },
    { id: Page.MOVIES, label: 'Filmes' },
    { id: Page.SERIES, label: 'Séries' },
    { id: Page.KIDS, label: 'Kids' },
    { id: Page.LIVE, label: 'TV ao vivo' },
    { id: Page.MY_LIST, label: 'Minha Lista' },
  ];

  return (
    <nav className="flex items-center justify-between w-full" data-nav-row={0}>
      {/* Esquerda: Logo + Links */}
      <div className="flex items-center gap-4">
        {/* Logo REDX */}
        <img
          src="/logored.png"
          alt="Redflix"
          className="h-6 w-auto object-contain drop-shadow-md cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onNavigate(Page.HOME)}
        />

        {/* Menu Links */}
        <div className="flex items-center gap-6">
          {navItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => { playSelectSound(); onNavigate(item.id); }}
              className={`text-[15px] font-medium transition-colors outline-none focus:text-white focus:scale-105
                ${currentPage === item.id ? 'text-white font-bold' : 'text-gray-300 hover:text-white'}`}
              tabIndex={0}
              data-nav-item
              data-nav-col={idx}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  playSelectSound();
                  onNavigate(item.id);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Direita: Busca + Perfil */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => { playSelectSound(); onNavigate(Page.SEARCH); }}
          className="text-gray-300 hover:text-white transition-colors outline-none focus:scale-110"
          aria-label="Buscar"
          data-nav-item
          data-nav-col={navItems.length}
        >
          <Search size={20} />
        </button>

        <button
          onClick={() => { playSelectSound(); onProfileClick(); }}
          className="w-8 h-8 rounded-full overflow-hidden border border-transparent hover:border-white transition-all focus:outline-none focus:ring-2 focus:ring-white"
          data-nav-item
          data-nav-col={navItems.length + 1}
        >
          <img src={profile?.avatar || '/logored.png'} alt={profile?.name || 'Perfil'} className="w-full h-full object-cover" />
        </button>
      </div>
    </nav>
  );
};

export default Navigation;

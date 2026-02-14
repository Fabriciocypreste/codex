import React from 'react';
import { Home, BarChart2, User, Calendar, Zap, Bell, Settings } from 'lucide-react';
import { Page, UserProfile } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  activeProfile: UserProfile | null;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, activeProfile }) => {
  const navItems = [
    { icon: Home, page: Page.HOME, label: 'Home' },
    { icon: BarChart2, page: Page.MOVIES, label: 'Movies' },
    { icon: User, page: Page.SERIES, label: 'Series' },
    { icon: Calendar, page: Page.MY_LIST, label: 'My List' },
    { icon: Zap, page: Page.LIVE, label: 'Live TV' },
    { icon: Bell, page: Page.KIDS, label: 'Kids' },
  ];

  return (
    <div className="app-sidebar">
      {/* Logo */}
      <div className="sidebar-logo-container">
        <div className="sidebar-logo-icon flex items-center justify-center">
           <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M7 0L14 4V14L7 18L0 14V4L7 0Z" fill="white"/>
           </svg>
        </div>
      </div>

      {/* Navigation Icons */}
      <div className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`sidebar-icon-btn ${currentPage === item.page ? 'active' : ''}`}
            onClick={() => onNavigate(item.page)}
          >
            <item.icon size={24} />
          </button>
        ))}
      </div>

      {/* Footer (Settings + Avatar) */}
      <div className="sidebar-footer pb-8">
        <button
          className={`sidebar-icon-btn ${currentPage === Page.SETTINGS ? 'active' : ''}`}
          onClick={() => onNavigate(Page.SETTINGS)}
        >
          <Settings size={24} />
        </button>
        
        {activeProfile && (
          <div className="sidebar-avatar">
            <img src={activeProfile.avatar} alt={activeProfile.name} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
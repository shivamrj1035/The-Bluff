import React from 'react';
import { useGameStore } from '../../games/bluff/store/useGameStore';

const Preloader = ({ isExiting }) => {
  const { siteSettings } = useGameStore();
  
  return (
    <div className={`preloader-overlay ${isExiting ? 'exit' : ''}`}>
      <div className="preloader-content">
        <div className="preloader-logo-container">
          <div className="preloader-logo-glow" />
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="preloader-logo-img"
          />
          <div className="preloader-ring" />
        </div>
        
        <div className="preloader-text-container">
          <h2 className="preloader-title">
            {siteSettings?.header_title || 'GameArena'}
          </h2>
          <div className="preloader-bar">
            <div className="preloader-progress"></div>
          </div>
          <p className="preloader-subtitle">Preparing your table...</p>
        </div>
      </div>
    </div>
  );
};

export default Preloader;


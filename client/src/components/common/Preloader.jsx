import React from 'react';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './Icons';

const Preloader = ({ isExiting }) => {
  const cards = [
    { icon: <SpadeIcon size={32} />, color: '#fff', delay: '0s' },
    { icon: <HeartIcon size={32} color="#ef4444" />, color: '#ef4444', delay: '0.2s' },
    { icon: <ClubIcon size={32} />, color: '#fff', delay: '0.4s' },
    { icon: <DiamondIcon size={32} color="#ef4444" />, color: '#ef4444', delay: '0.6s' },
  ];

  return (
    <div className={`preloader-overlay ${isExiting ? 'exit' : ''}`}>
      <div className="preloader-content">
        <div className="preloader-cards">
          {cards.map((card, index) => (
            <div 
              key={index} 
              className="preloader-card" 
              style={{ '--delay': card.delay }}
            >
              <div className="preloader-card-inner">
                {card.icon}
              </div>
            </div>
          ))}
        </div>
        <div className="preloader-text-container">
          <h2 className="preloader-title">CardNexus</h2>
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

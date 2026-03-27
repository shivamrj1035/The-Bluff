import { useCallback } from 'react';

const SOUNDS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
};

export const useSound = () => {
  const play = useCallback((key = 'click') => {
    const url = SOUNDS[key] || SOUNDS.click;
    const audio = new Audio(url);
    audio.volume = 0.2;
    audio.play().catch(() => {});
  }, []);

  return { play };
};

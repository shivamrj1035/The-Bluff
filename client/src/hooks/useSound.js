import { useCallback } from 'react';

const SOUNDS = {
  card_play: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a1b1b1.mp3',
  turn_ding: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  bluff_alert: 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3',
};

export const useSound = () => {
  const play = useCallback((key) => {
    const url = SOUNDS[key];
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(() => {
      // Browsers often block auto-play until user interaction
    });
  }, []);

  return { play };
};

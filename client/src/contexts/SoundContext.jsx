import React, { createContext, useContext, useState, useEffect } from 'react';

const SoundContext = createContext();

export function useSound() {
  return useContext(SoundContext);
}

export function SoundProvider({ children }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundAlertEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('soundAlertEnabled', JSON.stringify(isSoundEnabled));
  }, [isSoundEnabled]);

  const toggleSound = () => setIsSoundEnabled(prev => !prev);

  const playAlert = () => {
    if (!isSoundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        // Envelope to prevent clicking
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      playBeep(880, 0, 0.15); // A5
      playBeep(1046.50, 0.2, 0.2); // C6
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound, playAlert }}>
      {children}
    </SoundContext.Provider>
  );
}

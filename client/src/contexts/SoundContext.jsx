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
      
      const playBeep = (freq, startTime, duration, volume = 0.8) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine'; // Sine wave for clear bell sound
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        // Envelope for bell-like sound
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.05); // Attack
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration); // Long decay
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

    
      for (let i = 0; i < 8; i++) {
        const offset = i * 1.2; // ห่างกันรอบละ 1.2 วินาที
        playBeep(783.99, offset, 0.6, 0.8);       // Ding (G5) ดัง 0.8
        playBeep(659.25, offset + 0.3, 1.0, 0.8); // Dong (E5) ยาว 1.0 วิ
      }
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

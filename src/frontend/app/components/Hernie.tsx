'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface HernieProps {
  mood?: 'happy' | 'thinking' | 'excited' | 'sad';
  message?: string;
  className?: string;
}

export function Hernie({ mood = 'happy', message, className = '' }: HernieProps) {
  const [blink, setBlink] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const moodColors = {
    happy: '#FFD93D',
    thinking: '#6BCB77',
    excited: '#FF6B6B',
    sad: '#9C89B8',
  };

  return (
    <motion.div
      className={`flex items-center gap-3 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Hernie Character */}
      <motion.div
        className="relative w-16 h-16"
        animate={{
          y: mood === 'excited' ? [0, -10, 0] : 0,
          rotate: mood === 'thinking' ? [0, -10, 10, 0] : 0,
        }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {/* Body */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Main blob */}
          <motion.path
            d="M50 10 C70 10 85 25 85 50 C85 75 70 90 50 90 C30 90 15 75 15 50 C15 25 30 10 50 10"
            fill={moodColors[mood]}
            animate={{
              d: [
                "M50 10 C70 10 85 25 85 50 C85 75 70 90 50 90 C30 90 15 75 15 50 C15 25 30 10 50 10",
                "M50 12 C72 12 87 27 87 50 C87 73 72 88 50 88 C28 88 13 73 13 50 C13 27 28 12 50 12",
                "M50 10 C70 10 85 25 85 50 C85 75 70 90 50 90 C30 90 15 75 15 50 C15 25 30 10 50 10",
              ]
            }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
          
          {/* Eyes */}
          {!blink ? (
            <>
              <circle cx="35" cy="40" r="6" fill="#1a1a2e" />
              <circle cx="65" cy="40" r="6" fill="#1a1a2e" />
              {/* Shine */}
              <circle cx="37" cy="38" r="2" fill="white" />
              <circle cx="67" cy="38" r="2" fill="white" />
            </>
          ) : (
            <>
              <line x1="29" y1="40" x2="41" y2="40" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" />
              <line x1="59" y1="40" x2="71" y2="40" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" />
            </>
          )}
          
          {/* Mouth based on mood */}
          {mood === 'happy' && (
            <path d="M35 60 Q50 70 65 60" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
          {mood === 'excited' && (
            <path d="M30 55 Q50 80 70 55" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
          {mood === 'thinking' && (
            <circle cx="50" cy="62" r="3" fill="#1a1a2e" />
          )}
          {mood === 'sad' && (
            <path d="M35 70 Q50 60 65 70" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
          
          {/* Cheeks */}
          <circle cx="25" cy="50" r="5" fill="#ff9999" opacity="0.6" />
          <circle cx="75" cy="50" r="5" fill="#ff9999" opacity="0.6" />
        </svg>
        
        {/* Floating sparkles */}
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          ✨
        </motion.div>
      </motion.div>
      
      {/* Speech bubble */}
      {message && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white rounded-2xl p-4 shadow-lg border-4 border-purple-200 max-w-xs"
        >
          <p className="text-sm text-gray-700 font-medium">{message}</p>
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-l-4 border-b-4 border-purple-200 rotate-45" />
        </motion.div>
      )}
    </motion.div>
  );
}

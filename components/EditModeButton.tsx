'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EditModeButtonProps {
  isEditMode: boolean;
  onToggle: () => void;
}

export default function EditModeButton({ isEditMode, onToggle }: EditModeButtonProps) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    // Only run on client after hydration
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
    const isDev = process.env.NODE_ENV === 'development';
    const hasFlag = process.env.NEXT_PUBLIC_ENABLE_EDIT_MODE === 'true';

    setCanEdit(isDev && hasFlag && isLocalhost);
  }, []);

  if (!canEdit) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={`px-3 py-1.5 rounded font-bold text-xs uppercase tracking-wide transition-all ${
        isEditMode
          ? 'text-orange-400 border border-orange-400/50'
          : 'text-gray-300 border border-white/20'
      }`}
      style={{
        backgroundColor: isEditMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'
      }}
    >
      <div className="flex items-center gap-1.5">
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        {isEditMode ? 'Exit' : 'Edit'}
      </div>
    </motion.button>
  );
}

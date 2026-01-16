'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string; // Optional - if not provided, only show confirm button
  onConfirm: () => void;
  onCancel: () => void;
  singleButton?: boolean; // If true, only show the confirm button
}

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  singleButton = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg mx-4"
          >
            {/* Content Area - Cream background */}
            <div
              className="rounded-t-lg px-8 py-6"
              style={{ backgroundColor: '#f5f0dc' }}
            >
              <h2 className="text-[#1a2744] font-extrabold text-2xl tracking-wide mb-2">
                {title}
              </h2>
              <p className="text-[#78716c] text-base">
                {description}
              </p>
            </div>

            {/* Buttons Area - Dark background */}
            <div
              className={`rounded-b-lg px-8 py-5 flex ${singleButton ? 'justify-center' : 'gap-4'}`}
              style={{ backgroundColor: '#0f1729' }}
            >
              {/* Cancel Button - Dark (only show if not single button mode) */}
              {!singleButton && cancelText && (
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-6 rounded-full font-bold text-sm uppercase tracking-wide transition-all text-white"
                  style={{ backgroundColor: '#1a2744' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#243352'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a2744'}
                >
                  {cancelText}
                </button>
              )}

              {/* Confirm Button - Yellow/Gold */}
              <button
                onClick={onConfirm}
                className={`${singleButton ? 'w-full' : 'flex-1'} py-3 px-6 rounded-full font-bold text-sm uppercase tracking-wide transition-all text-[#1a2744]`}
                style={{ backgroundColor: '#f5b942' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffc94d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b942'}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

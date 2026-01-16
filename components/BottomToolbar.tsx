'use client';

import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ConfirmationModal from './ConfirmationModal';

type ConfigMode = 'current' | 'proto';

type ModalType = 'reset' | 'share' | null;

// Expandable button component - defined outside to prevent re-renders
const ExpandableButton = memo(({
  onClick,
  label,
  icon,
  isActive = false,
  activeColor = '#a89f91'
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  activeColor?: string;
}) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`h-10 rounded-full flex items-center transition-all duration-100 group overflow-hidden active:brightness-125 ${
      isActive ? 'text-[#2d2d2d]' : 'text-[#a89f91] hover:text-white'
    }`}
    style={{
      backgroundColor: isActive ? activeColor : '#2d2d2d',
      paddingLeft: '12px',
      paddingRight: '12px',
    }}
  >
    <span className="w-5 h-5 shrink-0 flex items-center justify-center">
      {icon}
    </span>
    <span className={`text-xs font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden transition-all duration-200 ${
      isActive ? 'text-[#2d2d2d]' : 'text-[#a89f91] group-hover:text-white'
    } max-w-0 group-hover:max-w-[100px] group-hover:ml-2`}>
      {label}
    </span>
  </motion.button>
));
ExpandableButton.displayName = 'ExpandableButton';

interface BottomToolbarProps {
  onShare: () => void;
  onReset: () => void;
  onEditModeToggle: () => void;
  onOpenSettings: () => void;
  isEditMode: boolean;
  totalPoints: number;
  maxPoints: number;
  mode?: ConfigMode;
  isWindowActive?: boolean;
  particlesPaused?: boolean;
  onToggleParticles?: () => void;
}

export default function BottomToolbar({
  onShare,
  onReset,
  onEditModeToggle,
  onOpenSettings,
  isEditMode,
  totalPoints,
  maxPoints,
  mode = 'current',
  isWindowActive = true,
  particlesPaused = false,
  onToggleParticles,
}: BottomToolbarProps) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const isProtoMode = mode === 'proto';

  const handlePrototypeToggle = () => {
    if (isProtoMode) {
      router.push('/');
    } else {
      router.push('/proto');
    }
  };

  useEffect(() => {
    // Only allow edit mode on localhost in development
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
    const isDev = process.env.NODE_ENV === 'development';
    const hasFlag = process.env.NEXT_PUBLIC_ENABLE_EDIT_MODE === 'true';

    setCanEdit(isDev && hasFlag && isLocalhost);
  }, []);

  const handleSettingsClick = () => {
    if (canEdit) {
      onEditModeToggle();
      // Open settings panel when entering edit mode
      if (!isEditMode) {
        onOpenSettings();
      }
    }
  };

  const handleResetClick = () => {
    setActiveModal('reset');
  };

  const handleShareClick = () => {
    // Copy URL immediately, then show confirmation
    onShare();
    setActiveModal('share');
  };

  const handleConfirmReset = () => {
    onReset();
    setActiveModal(null);
  };

  const handleCloseShareModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

      {/* Bottom row: All buttons with labels */}
      <div className="flex items-center gap-2">
        {/* Eco Mode Button - Toggle particles */}
        {onToggleParticles && (
          <ExpandableButton
            onClick={onToggleParticles}
            label="Eco"
            isActive={particlesPaused}
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
              </svg>
            }
          />
        )}

        {/* Reset Button */}
        <ExpandableButton
          onClick={handleResetClick}
          label="Reset"
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4V1L7 5l5 5V7c2.76 0 5 2.24 5 5 0 .85-.22 1.65-.6 2.35l1.5 1.5C19.6 14.65 20 13.38 20 12c0-4.42-3.58-8-8-8zm0 14c-2.76 0-5-2.24-5-5 0-.85.22-1.65.6-2.35l-1.5-1.5C4.4 10.35 4 11.62 4 13c0 4.42 3.58 8 8 8v3l5-5-5-5v4z"/>
            </svg>
          }
        />

        {/* Share Button */}
        <ExpandableButton
          onClick={handleShareClick}
          label="Share"
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
          }
        />

        {/* Prototype/Return Button */}
        <ExpandableButton
          onClick={handlePrototypeToggle}
          label={isProtoMode ? "Return" : "Proto"}
          icon={
            isProtoMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 11H6.83l3.88-3.88a1.5 1.5 0 10-2.12-2.12l-6.59 6.59a1.5 1.5 0 000 2.12l6.59 6.59a1.5 1.5 0 102.12-2.12L6.83 14H20c.83 0 1.5-.67 1.5-1.5S20.83 11 20 11z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
                <defs>
                  <style>
                    {`
                      @keyframes bubble-up-1 {
                        0% { opacity: 0; transform: translateY(0); }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { opacity: 0; transform: translateY(-8px); }
                      }
                      @keyframes bubble-up-2 {
                        0% { opacity: 0; transform: translateY(0); }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { opacity: 0; transform: translateY(-10px); }
                      }
                      @keyframes bubble-up-3 {
                        0% { opacity: 0; transform: translateY(0); }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { opacity: 0; transform: translateY(-7px); }
                      }
                    `}
                  </style>
                </defs>
                <path fill="currentColor" d="M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"/>
                <circle
                  cx="10.5" cy="4" r="1" fill="currentColor"
                  style={{ animation: 'bubble-up-1 2s ease-out infinite', animationPlayState: isWindowActive ? 'running' : 'paused' }}
                />
                <circle
                  cx="12" cy="4.5" r="0.8" fill="currentColor"
                  style={{ animation: 'bubble-up-2 2.4s ease-out infinite 0.6s', animationPlayState: isWindowActive ? 'running' : 'paused' }}
                />
                <circle
                  cx="13.5" cy="4" r="0.6" fill="currentColor"
                  style={{ animation: 'bubble-up-3 2.2s ease-out infinite 1.2s', animationPlayState: isWindowActive ? 'running' : 'paused' }}
                />
              </svg>
            )
          }
        />

        {/* Settings Button (Cog) - only visible when canEdit */}
        {canEdit && (
          <ExpandableButton
            onClick={handleSettingsClick}
            label={isEditMode ? "Exit" : "Edit"}
            isActive={isEditMode}
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            }
          />
        )}
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={activeModal === 'reset'}
        title="RESET ALL POINTS?"
        description="Are you sure you want to reset all skill points? This action cannot be undone."
        confirmText="YES, RESET"
        cancelText="NO, KEEP POINTS"
        onConfirm={handleConfirmReset}
        onCancel={() => setActiveModal(null)}
      />

      {/* Share Confirmation Modal */}
      <ConfirmationModal
        isOpen={activeModal === 'share'}
        title="SHARE BUILD"
        description="The current build URL has been copied to your clipboard."
        confirmText="OK, UNDERSTOOD"
        onConfirm={handleCloseShareModal}
        onCancel={handleCloseShareModal}
        singleButton={true}
      />
    </div>
  );
}

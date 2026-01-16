'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SkillNode, TreeType } from '@/types/skills';
import { useSkillTree } from '@/context/SkillContext';
import Image from 'next/image';
import { TreeSettings } from '@/utils/configExport';

interface SkillTooltipProps {
  skillId: string;
  x: number;
  y: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center-right' | 'center-left';
  effectiveNodes: SkillNode[];
  treeSettings?: Record<TreeType, TreeSettings> | null;
  onMeasure?: (width: number, height: number) => void;
  visible?: boolean;
  compact?: boolean;
  // Mobile landscape mode props for point editing
  isMobileLandscape?: boolean;
  canAdd?: boolean;
  canRemove?: boolean;
  onAddPoint?: () => void;
  onRemovePoint?: () => void;
}

export default function SkillTooltip({
  skillId,
  x,
  y,
  position,
  effectiveNodes,
  treeSettings,
  onMeasure,
  visible = true,
  compact = false,
  isMobileLandscape = false,
  canAdd = false,
  canRemove = false,
  onAddPoint,
  onRemovePoint
}: SkillTooltipProps) {
  const { getSkillPoints, getTotalTreePoints } = useSkillTree();
  const skill = effectiveNodes.find((n) => n.id === skillId);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasMeasured = useRef(false);

  // Measure tooltip dimensions and report back to parent
  useEffect(() => {
    hasMeasured.current = false; // Reset when skillId changes
  }, [skillId]);

  useEffect(() => {
    if (tooltipRef.current && onMeasure && !hasMeasured.current) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        if (tooltipRef.current && !hasMeasured.current) {
          const rect = tooltipRef.current.getBoundingClientRect();
          onMeasure(rect.width, rect.height);
          hasMeasured.current = true;
        }
      });
    }
  });

  if (!skill) return null;

  const currentPoints = getSkillPoints(skillId);
  const totalTreePoints = getTotalTreePoints(skill.tree);

  // Check if this is a locked keystone (has pointsRequiredInTree and not enough points)
  const isLockedKeystone = (skill.pointsRequiredInTree ?? 0) > 0 &&
    totalTreePoints < (skill.pointsRequiredInTree ?? 0);

  // Get tree name for display - use settings name if available
  const getTreeDisplayName = (tree: string) => {
    if (treeSettings && treeSettings[tree as TreeType]?.name) {
      return treeSettings[tree as TreeType].name.toUpperCase();
    }
    return tree.toUpperCase();
  };

  // Determine transform based on position
  const getTransform = () => {
    switch (position) {
      case 'top-right':
      case 'top-left':
        return 'translate(0, -100%)'; // Anchor at bottom-left, tooltip goes up
      case 'bottom-right':
      case 'bottom-left':
        return 'translate(0, 0)'; // Anchor at top-left, tooltip goes down
      case 'center-right':
      case 'center-left':
        return 'translate(0, 0)'; // No transform, Y already centered
      default:
        return 'translate(0, -100%)';
    }
  };

  // Stop touch events from propagating to the viewport's touch handlers in mobile landscape mode
  const stopTouchPropagation = isMobileLandscape ? {
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
  } : {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`fixed z-50 ${isMobileLandscape ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        left: x,
        top: y,
        transform: getTransform(),
        willChange: 'opacity',
      }}
      {...stopTouchPropagation}
    >
      <div ref={tooltipRef} className={`rounded-lg shadow-2xl overflow-hidden ${compact ? 'min-w-[180px] max-w-60' : 'min-w-[280px] max-w-[400px]'}`}>
        {/* Main Content */}
        <div className={compact ? 'px-3 py-2' : 'px-5 py-4'} style={{ backgroundColor: '#f5f0dc' }}>
          {/* Skill Name - Bold Dark Blue, All Caps */}
          <h3 className={`text-[#1a2744] font-extrabold ${compact ? 'text-sm mb-0.5' : 'text-xl mb-1'}`}>
            {skill.name.toUpperCase()}
          </h3>

          {/* Description - Grey */}
          <p className={`text-[#78716c] leading-snug ${compact ? 'text-xs' : 'text-base'}`}>
            {skill.description}
          </p>

          {/* Points Info - Only show if maxPoints > 1 */}
          {(skill.maxPoints ?? 1) > 1 && (
            <p className={`text-[#1a2744] font-extrabold mt-1 ${compact ? 'text-xs' : 'text-base'}`}>
              {currentPoints}/{skill.maxPoints ?? 1}
            </p>
          )}

          {/* Locked Keystone - Show lock icon and points requirement */}
          {isLockedKeystone && (
            <div className={`flex items-center gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
              <Image
                src="/assets/LockForCards.svg"
                alt="Lock"
                width={compact ? 8 : 12}
                height={compact ? 10 : 15}
              />
              <span className={`text-[#1a2744] font-extrabold ${compact ? 'text-[10px]' : 'text-sm'}`}>
                REQUIRES {skill.pointsRequiredInTree} POINTS IN {getTreeDisplayName(skill.tree)}
              </span>
            </div>
          )}

        </div>

        {/* Notes Section - Full width blue stripe in mobile landscape mode */}
        {isMobileLandscape && skill.comment && skill.comment.trim() && (
          <div className="px-3 py-2" style={{ backgroundColor: '#0f1729' }}>
            <p className="text-white text-xs leading-snug">
              <span className="font-bold">Notes: </span>{skill.comment}
            </p>
          </div>
        )}

        {/* Mobile Landscape Point Controls */}
        {isMobileLandscape && (
          <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: '#f5f0dc' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemovePoint?.();
              }}
              disabled={!canRemove}
              className={`text-sm font-bold flex-1 py-0.5 transition-opacity ${
                canRemove ? 'text-[#1a2744] active:opacity-70' : 'text-[#b8b0a0] cursor-default'
              }`}
            >
              −1
            </button>
            <span className="text-[#d4cdb8]">|</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddPoint?.();
              }}
              disabled={!canAdd}
              className={`text-sm font-bold flex-1 py-0.5 transition-opacity ${
                canAdd ? 'text-[#1a2744] active:opacity-70' : 'text-[#b8b0a0] cursor-default'
              }`}
            >
              +1
            </button>
          </div>
        )}

        {/* Comment Section - Blue background, only shown when comment exists (hidden in compact mode and mobile landscape) */}
        {skill.comment && skill.comment.trim() && !compact && !isMobileLandscape && (
          <div className="px-5 py-3" style={{ backgroundColor: '#0f1729' }}>
            <p className="text-white text-sm leading-snug">
              <span className="font-bold">Notes: </span>{skill.comment}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

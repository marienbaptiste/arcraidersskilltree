'use client';

import React from 'react';
import { SkillNode, TreeType } from '@/types/skills';
import { useSkillTree } from '@/context/SkillContext';
import { TreeSettings } from '@/utils/configExport';

interface MobilePortraitCardProps {
  selectedSkillId: string | null;
  effectiveNodes: SkillNode[];
  treeSettings: Record<TreeType, TreeSettings> | null;
  portraitActiveTree: TreeType | null;
  canAdd: boolean;
  canRemove: boolean;
  onAddPoint: () => void;
  onRemovePoint: () => void;
  totalPoints: number;
  maxPoints: number;
  pointsDisplayMode: 'spent' | 'remaining';
  onTogglePointsDisplayMode: () => void;
  isMaxPointsFlash: boolean;
}

export default function MobilePortraitCard({
  selectedSkillId,
  effectiveNodes,
  treeSettings,
  portraitActiveTree,
  canAdd,
  canRemove,
  onAddPoint,
  onRemovePoint,
  totalPoints,
  maxPoints,
  pointsDisplayMode,
  onTogglePointsDisplayMode,
  isMaxPointsFlash,
}: MobilePortraitCardProps) {
  const { getSkillPoints, getTotalTreePoints } = useSkillTree();

  const skill = selectedSkillId ? effectiveNodes.find((n) => n.id === selectedSkillId) : null;
  const currentPoints = skill ? getSkillPoints(skill.id) : 0;
  const treePoints = portraitActiveTree ? getTotalTreePoints(portraitActiveTree) : 0;

  // Check if this is a locked keystone
  const isLockedKeystone = skill && (skill.pointsRequiredInTree ?? 0) > 0 &&
    treePoints < (skill.pointsRequiredInTree ?? 0);

  // Get tree display name
  const getTreeDisplayName = (tree: TreeType) => {
    if (treeSettings && treeSettings[tree]?.name) {
      return treeSettings[tree].name.toUpperCase();
    }
    return tree;
  };

  const treeName = portraitActiveTree ? getTreeDisplayName(portraitActiveTree) : '';

  // Stop touch events from propagating to the viewport's touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="rounded-t-2xl shadow-2xl overflow-hidden"
      style={{
        backgroundColor: '#f5f0dc',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Header Row - Tree info and total points */}
      <div className="flex items-center px-4 py-2 border-b border-[#d4cdb8]">
        {/* Tree name and points - left aligned */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-base font-extrabold uppercase text-[#1a2744]">
            {treeName}
          </span>
          <span className="text-base font-extrabold text-[#1a2744]">
            {treePoints}
          </span>
          {/* Thick bar separator with tree color */}
          <div
            className="w-1 h-6 rounded-full ml-1"
            style={{ backgroundColor: treeSettings?.[portraitActiveTree as TreeType]?.color ?? '#1a2744' }}
          />
        </div>

        {/* Circular progress ring - total points (tappable to toggle spent/remaining) */}
        <button
          className="flex items-center gap-1.5 shrink-0"
          onClick={onTogglePointsDisplayMode}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="relative w-8 h-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background circle - flashes when at max */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill={isMaxPointsFlash ? '#c53030' : 'none'}
                stroke={isMaxPointsFlash ? '#c53030' : '#d4cdb8'}
                strokeWidth="4"
                style={{ transition: 'fill 0.15s ease-out, stroke 0.15s ease-out' }}
              />
              {/* Progress circle */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#1a2744"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={pointsDisplayMode === 'spent'
                  ? `${(totalPoints / maxPoints) * 88} 88`
                  : `${((maxPoints - totalPoints) / maxPoints) * 88} 88`
                }
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-bold text-[10px]"
                style={{
                  color: isMaxPointsFlash ? '#ffffff' : '#1a2744',
                  transition: 'color 0.15s ease-out'
                }}
              >
                {pointsDisplayMode === 'spent' ? totalPoints : maxPoints - totalPoints}
              </span>
            </div>
          </div>
          <span className="text-sm text-[#78716c] font-medium w-10">
            {pointsDisplayMode === 'spent' ? 'Spent' : 'Left'}
          </span>
        </button>
      </div>

      {/* Skill Content */}
      <div className="px-5 py-4">
        {skill ? (
          <>
            {/* Skill Name */}
            <h3 className="text-[#1a2744] font-extrabold text-xl mb-1">
              {skill.name.toUpperCase()}
            </h3>

            {/* Description */}
            <p className="text-[#78716c] text-base leading-snug">
              {skill.description}
            </p>

            {/* Points Info - Only show if maxPoints > 1 */}
            {(skill.maxPoints ?? 1) > 1 && (
              <p className="text-[#1a2744] font-extrabold text-base mt-1">
                {currentPoints}/{skill.maxPoints ?? 1}
              </p>
            )}

            {/* Locked Keystone */}
            {isLockedKeystone && (
              <div className="flex items-center gap-2 mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/LockForCards.svg"
                  alt="Lock"
                  width={12}
                  height={15}
                />
                <span className="text-[#1a2744] font-extrabold text-sm">
                  REQUIRES {skill.pointsRequiredInTree} POINTS IN {getTreeDisplayName(skill.tree as TreeType)}
                </span>
              </div>
            )}
          </>
        ) : (
          // Placeholder when no skill selected
          <p className="text-[#a89f91] text-base italic text-center py-2">
            Tap a skill to view details
          </p>
        )}
      </div>

      {/* Notes Section - Blue stripe, only when skill has comment */}
      {skill?.comment && skill.comment.trim() && (
        <div className="px-5 py-3" style={{ backgroundColor: '#0f1729' }}>
          <p className="text-white text-sm leading-snug">
            <span className="font-bold">Notes: </span>{skill.comment}
          </p>
        </div>
      )}

      {/* Action Buttons - +1/-1 */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t border-[#d4cdb8]"
        style={{ backgroundColor: '#f5f0dc' }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemovePoint();
          }}
          disabled={!canRemove || !skill}
          className={`text-base font-bold flex-1 py-1 transition-opacity ${
            canRemove && skill ? 'text-[#1a2744] active:opacity-70' : 'text-[#b8b0a0] cursor-default'
          }`}
        >
          −1
        </button>
        <span className="text-[#d4cdb8] text-lg">|</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddPoint();
          }}
          disabled={!canAdd || !skill}
          className={`text-base font-bold flex-1 py-1 transition-opacity ${
            canAdd && skill ? 'text-[#1a2744] active:opacity-70' : 'text-[#b8b0a0] cursor-default'
          }`}
        >
          +1
        </button>
      </div>
    </div>
  );
}

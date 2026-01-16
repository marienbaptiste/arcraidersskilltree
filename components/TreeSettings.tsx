'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TreeType } from '@/types/skills';
import { useSkillTree } from '@/context/SkillContext';

export interface TreeSettings {
  name: string;
  color: string;
  visible: boolean;
}

interface TreeSettingsProps {
  isEditMode: boolean;
  initialSettings: Record<TreeType, TreeSettings>;
  onSave: (settings: Record<TreeType, TreeSettings>) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isProtoMode?: boolean;
}

export default function TreeSettings({
  isEditMode,
  initialSettings,
  onSave,
  externalOpen,
  onOpenChange,
  isProtoMode = false
}: TreeSettingsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const [treeSettings, setTreeSettings] = useState<Record<TreeType, TreeSettings>>(initialSettings);
  const [editingTree, setEditingTree] = useState<TreeType | null>(null);
  const [editingMaxPoints, setEditingMaxPoints] = useState(false);

  const { getTotalTreePoints, getMaxSkillPoints } = useSkillTree();
  const [maxPointsValue, setMaxPointsValue] = useState(getMaxSkillPoints());

  // Update local state when initialSettings change
  useEffect(() => {
    setTreeSettings(initialSettings);
  }, [initialSettings]);

  // Update maxPointsValue when getMaxSkillPoints changes (e.g., mode switch)
  useEffect(() => {
    setMaxPointsValue(getMaxSkillPoints());
  }, [getMaxSkillPoints]);

  // Calculate total points spent across all trees
  const totalPointsSpent = (['A', 'B', 'C', 'D'] as TreeType[]).reduce(
    (sum, tree) => sum + getTotalTreePoints(tree),
    0
  );

  const maxPoints = getMaxSkillPoints();

  if (!isEditMode) return null;

  const handleSave = () => {
    onSave(treeSettings);
    setEditingTree(null);
  };

  const handleSaveMaxPoints = async () => {
    try {
      const mode = isProtoMode ? 'proto' : 'main';
      const response = await fetch(`/api/config?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSkillPoints: maxPointsValue }),
      });

      if (response.ok) {
        setEditingMaxPoints(false);
        // Reload the page to reflect the new max points
        window.location.reload();
      }
    } catch (error) {
      // Silently fail
    }
  };

  return (
    <>
      {/* Collapsed Bar - shows when panel is collapsed but still in edit mode */}
      <AnimatePresence>
        {isOpen && isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 right-4 z-50 rounded-lg shadow-2xl cursor-pointer overflow-hidden"
            onClick={() => setIsCollapsed(false)}
          >
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#f5f0dc' }}>
              <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Tree Config</h3>
              {/* Expand chevron */}
              <svg className="w-4 h-4" style={{ color: '#78716c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {isOpen && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 right-4 z-50 rounded-lg shadow-2xl w-80 overflow-hidden"
          >
            {/* Header - Cream background matching toast */}
            <div className="px-5 py-4" style={{ backgroundColor: '#f5f0dc' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Tree Config</h3>
                <div className="flex items-center gap-1">
                  {/* Collapse button */}
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="p-1 rounded transition-colors"
                    style={{ color: '#78716c' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1a2744'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#78716c'}
                    title="Collapse"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Close button */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded transition-colors"
                    style={{ color: '#78716c' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1a2744'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#78716c'}
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Max Points Display */}
              <div className="mb-3 p-2.5 rounded" style={{ backgroundColor: 'rgba(26, 39, 68, 0.08)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Total Points</span>
                  <button
                    onClick={() => setEditingMaxPoints(!editingMaxPoints)}
                    className="p-1.5 rounded-full transition-all"
                    style={{
                      backgroundColor: editingMaxPoints ? '#a89f91' : '#2d2d2d',
                      color: editingMaxPoints ? '#2d2d2d' : '#a89f91'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = editingMaxPoints ? '#b8a99a' : '#3d3d3d';
                      if (!editingMaxPoints) e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = editingMaxPoints ? '#a89f91' : '#2d2d2d';
                      e.currentTarget.style.color = editingMaxPoints ? '#2d2d2d' : '#a89f91';
                    }}
                    title={editingMaxPoints ? 'Done editing' : 'Edit max points'}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                  </button>
                </div>
                {editingMaxPoints ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wide font-medium" style={{ color: '#78716c' }}>Max Skill Points</label>
                      <input
                        type="number"
                        min="1"
                        value={maxPointsValue}
                        onChange={(e) => setMaxPointsValue(parseInt(e.target.value) || 1)}
                        className="w-16 px-3 py-1.5 rounded-full text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSaveMaxPoints();
                      }}
                      className="w-full px-3 py-2 text-xs font-bold uppercase tracking-wide rounded-full transition-all"
                      style={{ backgroundColor: '#f5b942', color: '#1a2744' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffc94d'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b942'}
                    >
                      Save Max Points
                    </button>
                  </div>
                ) : (
                  <span className="text-base font-extrabold" style={{ color: '#1a2744' }}>
                    {totalPointsSpent} / {maxPoints}
                  </span>
                )}
              </div>

              {/* Tree Settings */}
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as TreeType[]).map((tree) => (
                  <div key={tree} className="rounded p-2.5" style={{ backgroundColor: 'rgba(26, 39, 68, 0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Tree {tree}</span>
                      <button
                        onClick={() => setEditingTree(editingTree === tree ? null : tree)}
                        className="p-1.5 rounded-full transition-all"
                        style={{
                          backgroundColor: editingTree === tree ? '#a89f91' : '#2d2d2d',
                          color: editingTree === tree ? '#2d2d2d' : '#a89f91'
                        }}
                        onMouseEnter={(e) => {
                          const isEditing = editingTree === tree;
                          e.currentTarget.style.backgroundColor = isEditing ? '#b8a99a' : '#3d3d3d';
                          if (!isEditing) e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          const isEditing = editingTree === tree;
                          e.currentTarget.style.backgroundColor = isEditing ? '#a89f91' : '#2d2d2d';
                          e.currentTarget.style.color = isEditing ? '#2d2d2d' : '#a89f91';
                        }}
                        title={editingTree === tree ? 'Done editing' : `Edit Tree ${tree}`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                      </button>
                    </div>

                    {editingTree === tree ? (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs mb-1 uppercase tracking-wide font-medium" style={{ color: '#78716c' }}>Name</label>
                          <input
                            type="text"
                            value={treeSettings[tree].name}
                            onChange={(e) =>
                              setTreeSettings({
                                ...treeSettings,
                                [tree]: { ...treeSettings[tree], name: e.target.value },
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-full text-sm focus:outline-none"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1 uppercase tracking-wide font-medium" style={{ color: '#78716c' }}>Color</label>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full cursor-pointer overflow-hidden shrink-0"
                              style={{ backgroundColor: treeSettings[tree].color, border: '2px solid rgba(26, 39, 68, 0.2)' }}
                            >
                              <input
                                type="color"
                                value={treeSettings[tree].color}
                                onChange={(e) =>
                                  setTreeSettings({
                                    ...treeSettings,
                                    [tree]: { ...treeSettings[tree], color: e.target.value },
                                  })
                                }
                                className="w-full h-full cursor-pointer opacity-0"
                              />
                            </div>
                            <input
                              type="text"
                              value={treeSettings[tree].color}
                              onChange={(e) =>
                                setTreeSettings({
                                  ...treeSettings,
                                  [tree]: { ...treeSettings[tree], color: e.target.value },
                                })
                              }
                              className="flex-1 px-3 py-1.5 rounded-full text-xs font-mono focus:outline-none"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center cursor-pointer"
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                border: '1px solid rgba(26, 39, 68, 0.3)',
                              }}
                              onClick={() =>
                                setTreeSettings({
                                  ...treeSettings,
                                  [tree]: { ...treeSettings[tree], visible: !treeSettings[tree].visible },
                                })
                              }
                            >
                              {treeSettings[tree].visible && (
                                <svg className="w-3 h-3" fill="none" stroke="#1a2744" viewBox="0 0 24 24" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: '#78716c' }}>Visible</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded"
                          style={{ backgroundColor: treeSettings[tree].color, border: '1px solid rgba(26, 39, 68, 0.2)' }}
                        />
                        <span className="text-sm" style={{ color: '#78716c' }}>{treeSettings[tree].name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer - Dark blue background matching toast */}
            <div className="px-5 py-4" style={{ backgroundColor: '#0f1729' }}>
              <button
                onClick={handleSave}
                className="w-full py-3 font-bold text-sm uppercase tracking-wide rounded-full transition-all text-center"
                style={{ backgroundColor: '#f5b942', color: '#1a2744' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffc94d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b942'}
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

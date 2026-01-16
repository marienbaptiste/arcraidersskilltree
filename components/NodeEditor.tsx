'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SkillNode } from '@/types/skills';
import Image from 'next/image';

interface NodeEditorProps {
  node: SkillNode;
  onClose: () => void;
  onSave: (updatedNode: Partial<SkillNode>) => void;
}

export default function NodeEditor({ node, onClose, onSave }: NodeEditorProps) {
  const [formData, setFormData] = useState({
    name: node.name,
    description: node.description,
    comment: node.comment || '',
    maxPoints: node.maxPoints ?? 1,
    pointsRequiredInTree: node.pointsRequiredInTree ?? 0,
    iconPath: node.iconPath || '',
  });

  // Dynamically fetch available icons from API
  const [availableIcons, setAvailableIcons] = useState<string[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    const fetchIcons = async () => {
      try {
        const response = await fetch('/api/icons');
        if (response.ok) {
          const data = await response.json();
          setAvailableIcons(data.icons || []);
        }
      } catch (error) {
        console.error('Failed to fetch icons:', error);
      }
    };
    fetchIcons();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const selectIcon = (iconPath: string) => {
    setFormData({ ...formData, iconPath });
    setShowIconPicker(false);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden rounded-lg"
      >
        {/* Content Area - Cream background */}
        <div
          className="px-6 py-5 overflow-y-auto"
          style={{ backgroundColor: '#f5f0dc', maxHeight: 'calc(90vh - 80px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>
              Edit Node: {node.id}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: '#78716c' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1a2744'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#78716c'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-full text-sm focus:outline-none"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Comments</label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                rows={3}
                placeholder="Add a comment (shown in tooltip)"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none placeholder:text-[#78716c]/60"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
              />
            </div>

            {/* Icon Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Icon</label>
              <div className="flex items-center gap-2">
                {formData.iconPath && (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: '#0f1729', border: '2px solid rgba(26, 39, 68, 0.4)' }}
                  >
                    <Image
                      src={formData.iconPath}
                      alt="Selected icon"
                      width={36}
                      height={36}
                      className="object-contain"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full transition-all"
                  style={{ backgroundColor: '#1a2744', color: '#fff' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#243352'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a2744'}
                >
                  {formData.iconPath ? 'Change' : 'Select'}
                </button>
                {formData.iconPath && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, iconPath: '' })}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full transition-all"
                    style={{ backgroundColor: '#f5b942', color: '#1a2744' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffc94d'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b942'}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Icon Picker Grid */}
              {showIconPicker && (
                <div className="mt-2 p-2 rounded-lg max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-6 gap-2">
                    {availableIcons.map((iconPath, index) => (
                      <button
                        key={iconPath}
                        type="button"
                        onClick={() => selectIcon(iconPath)}
                        className="w-full aspect-square rounded-full p-1.5 transition-all flex items-center justify-center"
                        style={{
                          backgroundColor: '#0f1729',
                          border: formData.iconPath === iconPath ? '2px solid #f5b942' : '2px solid rgba(26, 39, 68, 0.4)'
                        }}
                        title={`Icon ${index + 1}`}
                      >
                        <Image
                          src={iconPath}
                          alt={`Icon ${index + 1}`}
                          width={48}
                          height={48}
                          className="object-contain"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Points Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between pr-8">
                <label className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Max Points</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxPoints}
                  onChange={(e) => setFormData({ ...formData, maxPoints: parseInt(e.target.value) })}
                  className="w-20 px-3 py-2 rounded-full text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
                />
              </div>

              {node.isKeyNode && (
                <div className="flex items-center justify-between pr-8">
                  <label className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>
                    Tree Points Req
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.pointsRequiredInTree}
                    onChange={(e) => setFormData({ ...formData, pointsRequiredInTree: parseInt(e.target.value) })}
                    className="w-20 px-3 py-2 rounded-full text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(26, 39, 68, 0.2)', color: '#1a2744' }}
                  />
                </div>
              )}
            </div>

            {/* Read-only Info */}
            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(26, 39, 68, 0.15)' }}>
              <h3 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1a2744' }}>Read-only Info</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: '#78716c' }}>ID:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>{node.id}</span>
                </div>
                <div>
                  <span style={{ color: '#78716c' }}>Tree:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>{node.tree}</span>
                </div>
                <div>
                  <span style={{ color: '#78716c' }}>Branch:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>{node.branch}</span>
                </div>
                <div>
                  <span style={{ color: '#78716c' }}>Tier:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>{node.tier}</span>
                </div>
                <div>
                  <span style={{ color: '#78716c' }}>Position:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>x={node.x.toFixed(2)}, y={node.y.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#78716c' }}>Key Node:</span>
                  <span className="ml-1.5" style={{ color: '#1a2744' }}>{node.isKeyNode ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - Dark blue background */}
        <div
          className="px-6 py-4 flex gap-3"
          style={{ backgroundColor: '#0f1729' }}
        >
          {/* Cancel Button - Dark */}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-6 rounded-full font-bold text-sm uppercase tracking-wide transition-all text-white"
            style={{ backgroundColor: '#1a2744' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#243352'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a2744'}
          >
            Cancel
          </button>

          {/* Save Button - Gold */}
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 py-3 px-6 rounded-full font-bold text-sm uppercase tracking-wide transition-all"
            style={{ backgroundColor: '#f5b942', color: '#1a2744' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffc94d'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b942'}
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

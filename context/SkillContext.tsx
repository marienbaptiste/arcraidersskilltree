'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SkillAction, SkillTreeState, TreeType } from '@/types/skills';
import { updateUrlWithSkills, getSkillPointsFromUrl, encodeSkillPointsToUrl } from '@/utils/urlEncoder';
import { skillNodes, getMaxSkillPoints as getDefaultMaxSkillPoints } from '@/data/configLoader';
import { canRemovePoint } from '@/data/skillLogic';

interface SkillContextType {
  state: SkillTreeState;
  dispatch: React.Dispatch<SkillAction>;
  addPoint: (skillId: string) => void;
  removePoint: (skillId: string) => void;
  setPoints: (skillId: string, points: number) => void;
  getSkillPoints: (skillId: string) => number;
  getTotalTreePoints: (treeId: TreeType) => number;
  getTotalPoints: () => number;
  isAtMaxPoints: () => boolean;
  resetAll: () => void;
  setHoveredSkill: (skillId: string | null) => void;
  getShareUrl: () => string;
  copyShareUrl: () => Promise<void>;
  getMaxSkillPoints: () => number;
  // Backward compatibility helpers
  unlockSkill: (skillId: string) => void;
  lockSkill: (skillId: string) => void;
}

const SkillContext = createContext<SkillContextType | undefined>(undefined);

// Create reducer with maxSkillPoints parameter
function createSkillReducer(maxSkillPointsRef: { current: number }) {
  return function skillReducer(state: SkillTreeState, action: SkillAction): SkillTreeState {
    switch (action.type) {
      case 'ADD_POINT': {
        const currentPoints = state.skillPoints.get(action.skillId) || 0;
        const node = skillNodes.find(n => n.id === action.skillId);
        if (!node) return state;

        // Don't exceed max points for this skill
        if (currentPoints >= (node.maxPoints ?? 1)) return state;

        // Calculate total points spent across all skills
        let totalPointsSpent = 0;
        state.skillPoints.forEach((points) => {
          totalPointsSpent += points;
        });

        // Don't exceed global max skill points
        if (totalPointsSpent >= maxSkillPointsRef.current) return state;

        const newSkillPoints = new Map(state.skillPoints);
        newSkillPoints.set(action.skillId, currentPoints + 1);
        return {
          ...state,
          skillPoints: newSkillPoints,
        };
      }
      case 'REMOVE_POINT': {
        const currentPoints = state.skillPoints.get(action.skillId) || 0;
        if (currentPoints === 0) return state;

        // Validate that removing this point won't break dependencies or gate requirements
        if (!canRemovePoint(action.skillId, state.skillPoints, skillNodes)) {
          return state;
        }

        const newSkillPoints = new Map(state.skillPoints);
        if (currentPoints === 1) {
          newSkillPoints.delete(action.skillId);
        } else {
          newSkillPoints.set(action.skillId, currentPoints - 1);
        }
        return {
          ...state,
          skillPoints: newSkillPoints,
        };
      }
      case 'SET_POINTS': {
        const node = skillNodes.find(n => n.id === action.skillId);
        if (!node) return state;

        const clampedPoints = Math.max(0, Math.min(action.points, node.maxPoints ?? 1));
        const newSkillPoints = new Map(state.skillPoints);

        if (clampedPoints === 0) {
          newSkillPoints.delete(action.skillId);
        } else {
          newSkillPoints.set(action.skillId, clampedPoints);
        }

        return {
          ...state,
          skillPoints: newSkillPoints,
        };
      }
      case 'RESET_ALL': {
        return {
          ...state,
          skillPoints: new Map(),
        };
      }
      case 'HOVER_SKILL': {
        return {
          ...state,
          hoveredSkill: action.skillId,
        };
      }
      case 'LOAD_STATE': {
        return {
          ...state,
          skillPoints: new Map(Object.entries(action.skillPoints)),
        };
      }
      default:
        return state;
    }
  };
}

const initialState: SkillTreeState = {
  skillPoints: new Map(),
  hoveredSkill: null,
};

export function SkillProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProtoMode = pathname?.startsWith('/proto');

  // Fetch max skill points based on mode
  const [maxSkillPoints, setMaxSkillPoints] = useState(getDefaultMaxSkillPoints());

  // Use ref to pass to reducer without causing re-renders
  const maxSkillPointsRef = React.useRef(maxSkillPoints);
  maxSkillPointsRef.current = maxSkillPoints;

  // Create reducer with the ref
  const reducer = React.useMemo(() => createSkillReducer(maxSkillPointsRef), []);
  const [state, dispatch] = useReducer(reducer, initialState);

  // Track previous mode to detect mode changes
  const prevModeRef = React.useRef(isProtoMode);

  // Fetch max skill points from API based on mode and reset points on mode change
  useEffect(() => {
    const modeChanged = prevModeRef.current !== isProtoMode;
    prevModeRef.current = isProtoMode;

    // Reset skill points when mode changes
    if (modeChanged) {
      dispatch({ type: 'RESET_ALL' });
    }

    const fetchMaxSkillPoints = async () => {
      try {
        const mode = isProtoMode ? 'proto' : 'main';
        const response = await fetch(`/api/config?mode=${mode}`);
        if (response.ok) {
          const data = await response.json();
          if (data.maxSkillPoints !== undefined) {
            setMaxSkillPoints(data.maxSkillPoints);
          }
        }
      } catch (error) {
        console.error('Failed to fetch max skill points:', error);
      }
    };
    fetchMaxSkillPoints();

    // After fetching, load from URL (for the new mode)
    if (modeChanged) {
      const skillPoints = getSkillPointsFromUrl();
      if (Object.keys(skillPoints).length > 0) {
        dispatch({ type: 'LOAD_STATE', skillPoints });
      }
    }
  }, [isProtoMode]);

  // Load from URL on initial mount only
  useEffect(() => {
    const skillPoints = getSkillPointsFromUrl();
    if (Object.keys(skillPoints).length > 0) {
      dispatch({ type: 'LOAD_STATE', skillPoints });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-update URL when state changes
  useEffect(() => {
    updateUrlWithSkills(state.skillPoints);
  }, [state.skillPoints]);

  const addPoint = (skillId: string) => {
    dispatch({ type: 'ADD_POINT', skillId });
  };

  const removePoint = (skillId: string) => {
    dispatch({ type: 'REMOVE_POINT', skillId });
  };

  const setPoints = (skillId: string, points: number) => {
    dispatch({ type: 'SET_POINTS', skillId, points });
  };

  const getSkillPoints = (skillId: string): number => {
    return state.skillPoints.get(skillId) || 0;
  };

  const getTotalTreePoints = (treeId: TreeType): number => {
    let total = 0;
    state.skillPoints.forEach((points, skillId) => {
      const node = skillNodes.find(n => n.id === skillId);
      if (node && node.tree === treeId) {
        total += points;
      }
    });
    return total;
  };

  const getTotalPoints = (): number => {
    let total = 0;
    state.skillPoints.forEach((points) => {
      total += points;
    });
    return total;
  };

  const isAtMaxPoints = (): boolean => {
    return getTotalPoints() >= maxSkillPoints;
  };

  const getMaxSkillPoints = (): number => {
    return maxSkillPoints;
  };

  const resetAll = () => {
    dispatch({ type: 'RESET_ALL' });
  };

  const setHoveredSkill = (skillId: string | null) => {
    dispatch({ type: 'HOVER_SKILL', skillId });
  };

  // Backward compatibility: unlockSkill sets 1 point
  const unlockSkill = (skillId: string) => {
    const node = skillNodes.find(n => n.id === skillId);
    if (node) {
      dispatch({ type: 'SET_POINTS', skillId, points: 1 });
    }
  };

  // Backward compatibility: lockSkill sets 0 points
  const lockSkill = (skillId: string) => {
    dispatch({ type: 'SET_POINTS', skillId, points: 0 });
  };

  const getShareUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const encoded = encodeSkillPointsToUrl(state.skillPoints);

    if (encoded) {
      // Set version parameter first, then build (version 3 encoder)
      url.searchParams.set('v', '3');
      url.searchParams.set('build', encoded);
    } else {
      url.searchParams.delete('v');
      url.searchParams.delete('build');
    }

    return url.toString();
  };

  const copyShareUrl = async (): Promise<void> => {
    try {
      const url = getShareUrl();
      await navigator.clipboard.writeText(url);
    } catch (error) {
      throw error;
    }
  };

  const value: SkillContextType = {
    state,
    dispatch,
    addPoint,
    removePoint,
    setPoints,
    getSkillPoints,
    getTotalTreePoints,
    getTotalPoints,
    isAtMaxPoints,
    resetAll,
    setHoveredSkill,
    getShareUrl,
    copyShareUrl,
    getMaxSkillPoints,
    unlockSkill,
    lockSkill,
  };

  return <SkillContext.Provider value={value}>{children}</SkillContext.Provider>;
}

export function useSkillTree() {
  const context = useContext(SkillContext);
  if (context === undefined) {
    throw new Error('useSkillTree must be used within a SkillProvider');
  }
  return context;
}

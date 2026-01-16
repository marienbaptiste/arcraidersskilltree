'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSkillTree } from '@/context/SkillContext';
import { skillNodes, skillPaths } from '@/data/configLoader';
import { getSkillState, canAddPoint, canRemovePoint } from '@/data/skillLogic';
import SkillNodeComponent from './SkillNode';
import SkillTooltip from './SkillTooltip';
import NodeEditor from './NodeEditor';
import TreeSettings from './TreeSettings';
import BottomToolbar from './BottomToolbar';
import ConfirmationModal from './ConfirmationModal';
import MobilePortraitCard from './MobilePortraitCard';
// ARTreeSVG removed - using only interactive overlay for tree visibility control
import { SkillNode, TreeType } from '@/types/skills';
import { exportConfig, downloadConfigAsJson, loadConfigFromJson, copyConfigToClipboard, TreeSettings as TreeSettingsType } from '@/utils/configExport';
import pathDataJson from '@/data/pathData.json';
import boundingBoxData from '@/public/boundingBoxes.json';
import treeTitlesData from '@/public/treeTitles.json';

// Path data mapping
const pathData: Record<string, string> = pathDataJson;

// Bounding box data
const treeBoundingBoxes = boundingBoxData.trees;

// Tree title positions
const treeTitles = treeTitlesData;

// Version label text (single source of truth)
const VERSION_LABEL = 'v1.0.1 - fan made unofficial calculator';

// Bottom connector paths for each tree (from SVG group membership)
const BOTTOM_CONNECTOR_PATHS = {
  A: 'path21', // Tree A bottom connector (in group g52)
  B: 'path2',  // Tree B bottom connector (in group layer1, labeled "Tree B path 0")
  C: 'path69', // Tree C bottom connector (in group g100, labeled "Tree B path 0" but belongs to Tree C)
  D: 'path1',  // Tree D bottom connector (in group g69)
} as const;

// Blob configuration in SVG coordinate units (viewBox is 717.06897 units wide)
// These values are relative to viewport center
const BLOB_CONFIG = {
  rightBlob: {
    offsetX: 150,   // SVG units right of center (more to the right)
    offsetY: -70,   // SVG units above center
    size: 200,      // SVG units diameter
    blur: 60,
    opacity: 0.7,
    gradient: 'radial-gradient(circle, #1a2540 0%, #101828 50%, transparent 70%)'
  },
  leftBlob: {
    offsetX: -350,  // SVG units left of center (more to the left)
    offsetY: -250,  // SVG units above center (higher up)
    size: 380,      // SVG units diameter
    blur: 80,
    opacity: 1.0,
    gradient: 'radial-gradient(circle, #1e2840 0%, #141c2e 30%, #0d1220 50%, transparent 70%)'
  }
} as const;

type ConfigMode = 'current' | 'proto';

interface SkillTreeProps {
  mode?: ConfigMode;
}

export default function SkillTree({ mode = 'current' }: SkillTreeProps = {}) {
  const { state, addPoint, removePoint, getSkillPoints, getTotalTreePoints, isAtMaxPoints, setHoveredSkill, resetAll, copyShareUrl, getMaxSkillPoints } = useSkillTree();
  const [tooltipData, setTooltipData] = useState<{
    skillId: string;
    x: number;
    y: number;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center-right' | 'center-left';
    measured: boolean;
  } | null>(null);
  const [tooltipDimensions, setTooltipDimensions] = useState<{ width: number; height: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showAllContainers, setShowAllContainers] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<SkillNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isViewInitialized, setIsViewInitialized] = useState(false);
  const [initialZoomLevel, setInitialZoomLevel] = useState(1); // Store initial zoom as minimum
  const [baseScale, setBaseScale] = useState(1); // pixels per SVG unit at zoom=1
  const [initialView, setInitialView] = useState<{ pan: { x: number; y: number }; zoom: number } | null>(null); // Store initial view for blob positioning
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(() => {
    // Check if we've already shown the loading screen in this session
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('loadingShown') === 'true';
    }
    return false;
  });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [bokehParticles, setBokehParticles] = useState<Array<{
    id: string;
    sizePercent: number;
    startX: number;
    startY: number;
    driftX: number;
    driftY: number;
    rotation: number;
    duration: number;
    delay: number;
    waypoints?: Array<{ x: number; y: number; percent: number }>;
  }>>([]);

  // Track window visibility for pausing animations
  const [isWindowActive, setIsWindowActive] = useState(true);
  // User toggle to pause particles
  const [particlesPaused, setParticlesPaused] = useState(false);

  // Points display mode: 'spent' or 'remaining'
  const [pointsDisplayMode, setPointsDisplayMode] = useState<'spent' | 'remaining'>('spent');

  // Flash animation when trying to add points beyond max
  const [isMaxPointsFlash, setIsMaxPointsFlash] = useState(false);

  // Configuration state - editable in edit mode
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, Partial<SkillNode>>>(new Map());
  const [treeSettings, setTreeSettings] = useState<Record<TreeType, TreeSettingsType> | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [treeSettingsVersion, setTreeSettingsVersion] = useState(0);

  // Mobile portrait mode state
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  // Mobile landscape mode state (view-only mode)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [portraitActiveTree, setPortraitActiveTree] = useState<TreeType | null>(null);
  const [selectedPortraitSkillId, setSelectedPortraitSkillId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [portraitCardHeight, setPortraitCardHeight] = useState(0);
  const prevPortraitCardHeightRef = useRef(0);
  const [portraitCardNode, setPortraitCardNode] = useState<HTMLDivElement | null>(null);
  const [isTreeTransitioning, setIsTreeTransitioning] = useState(false);

  // Touch gesture state for pinch-to-zoom and pan
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);
  const [isTouchPanning, setIsTouchPanning] = useState(false);

  // Track focused node for orientation change (landscape → portrait)
  const landscapeFocusedNodeRef = useRef<{ skillId: string; tree: TreeType } | null>(null);

  // Proto tree warning modal state
  const [showProtoWarning, setShowProtoWarning] = useState(false);
  const [protoWarningShown, setProtoWarningShown] = useState(false);

  // Mobile landscape toolbar tab state
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [showMobileProtoWarning, setShowMobileProtoWarning] = useState(false);
  const [showMobileHelpToast, setShowMobileHelpToast] = useState(false);
  const [showMobileResetConfirm, setShowMobileResetConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();
  const isProtoMode = mode === 'proto';

  // Load configuration from JSON on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/config?mode=${mode}`);
        if (response.ok) {
          const config = await response.json();

          // Load tree settings
          if (config.trees) {
            setTreeSettings(config.trees);
          }

          // Load node overrides
          if (config.nodeOverrides) {
            const overridesMap = new Map<string, Partial<SkillNode>>();
            Object.entries(config.nodeOverrides).forEach(([key, value]) => {
              overridesMap.set(key, value as Partial<SkillNode>);
            });
            setNodeOverrides(overridesMap);
          }

          setConfigLoaded(true);
        }
      } catch (error) {
        setConfigLoaded(true);
      }
    };

    loadConfig();
  }, [mode]);

  // Minimum loading time to show spinner animation (1 second)
  useEffect(() => {
    // If already shown in this session, skip the timer
    if (sessionStorage.getItem('loadingShown') === 'true') {
      setMinLoadingTimePassed(true);
      return;
    }

    // Otherwise start the timer
    const timer = setTimeout(() => {
      sessionStorage.setItem('loadingShown', 'true');
      setMinLoadingTimePassed(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Show proto warning modal/toast after loading completes (only once per session)
  useEffect(() => {
    if (
      mode === 'proto' &&
      minLoadingTimePassed &&
      isViewInitialized &&
      !protoWarningShown &&
      sessionStorage.getItem('protoWarningShown') !== 'true'
    ) {
      // Show mobile toast in landscape mode, otherwise show modal
      if (isMobileLandscape) {
        setShowMobileProtoWarning(true);
        setTimeout(() => setShowMobileProtoWarning(false), 4000);
      } else {
        setShowProtoWarning(true);
      }
      setProtoWarningShown(true);
      sessionStorage.setItem('protoWarningShown', 'true');
    }
  }, [mode, minLoadingTimePassed, isViewInitialized, protoWarningShown, isMobileLandscape]);

  // Mobile portrait and landscape mode detection
  useEffect(() => {
    const checkMobileMode = () => {
      // Detect touch capability (works for phones and tablets)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Also check user agent for tablets that might not report touch properly
      const userAgent = navigator.userAgent.toLowerCase();
      const isTabletUA = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent);
      const isMobileUA = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(userAgent);

      const isMobileOrTablet = isTouchDevice || isTabletUA || isMobileUA;
      const isPortrait = window.innerHeight > window.innerWidth;
      const isLandscape = window.innerWidth > window.innerHeight;

      const newIsMobilePortrait = isMobileOrTablet && isPortrait && window.innerWidth < 768;
      const newIsMobileLandscape = isMobileOrTablet && isLandscape;

      // Portrait mode: phones only (narrow width)
      setIsMobilePortrait(newIsMobilePortrait);

      // Landscape mode: any touch device in landscape (phones AND tablets)
      // Exclude desktop by checking for touch capability
      setIsMobileLandscape(newIsMobileLandscape);
    };

    checkMobileMode();
    window.addEventListener('resize', checkMobileMode);
    window.addEventListener('orientationchange', checkMobileMode);

    // Try to hide mobile browser URL bar by scrolling
    const hideUrlBar = () => {
      if (window.innerWidth < 768) {
        setTimeout(() => {
          window.scrollTo(0, 1);
        }, 100);
      }
    };
    hideUrlBar();

    // Track fullscreen state changes
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isNowFullscreen);

      // Dispatch resize event after browser updates viewport dimensions
      // This uses requestAnimationFrame to wait for the next paint
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Check initial fullscreen state
    handleFullscreenChange();

    return () => {
      window.removeEventListener('resize', checkMobileMode);
      window.removeEventListener('orientationchange', checkMobileMode);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);


  // Track if we've initialized for current portrait session (to avoid re-init on card height changes)
  const portraitInitializedRef = useRef(false);

  // Reset when entering/exiting portrait mode or changing trees
  useEffect(() => {
    portraitInitializedRef.current = false;
  }, [isMobilePortrait, portraitActiveTree]);

  // Calculate initial zoom and pan to fit visible trees on mount
  useEffect(() => {
    const calculateInitialView = () => {
      if (!containerRef.current || !treeSettings) return;

      // In portrait mode, wait until we have selected a tree and card height is measured
      if (isMobilePortrait && (!portraitActiveTree || !portraitCardHeight)) {
        return;
      }

      // Skip if already initialized for this portrait session (prevents re-init on card height changes)
      if (isMobilePortrait && portraitInitializedRef.current) {
        return;
      }

      if (isMobilePortrait) {
        portraitInitializedRef.current = true;
      }

      // Get window dimensions
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Get container width
      const containerWidth = containerRef.current.clientWidth;
      if (containerWidth === 0) {
        requestAnimationFrame(calculateInitialView);
        return;
      }

      // SVG viewBox dimensions
      const svgViewBoxWidth = 717.06897;

      // How many pixels per SVG unit at zoom=1
      const calculatedBaseScale = containerWidth / svgViewBoxWidth;

      // Get dynamic bounding box based on visible trees
      const allCorners: number[][] = [];
      (['A', 'B', 'C', 'D'] as const).forEach(tree => {
        const isVisible = isMobilePortrait && portraitActiveTree
          ? tree === portraitActiveTree
          : !treeSettings || treeSettings[tree]?.visible !== false;

        if (!isVisible) return;

        const treeData = treeBoundingBoxes[tree];
        if (treeData && treeData.corners) {
          treeData.corners.forEach((corner: number[]) => {
            allCorners.push(corner);
          });
        }
      });

      let bbox;
      if (allCorners.length === 0) {
        bbox = boundingBoxData.overallBoundingBox;
      } else {
        const minX = Math.min(...allCorners.map(c => c[0]));
        const maxX = Math.max(...allCorners.map(c => c[0]));
        const minY = Math.min(...allCorners.map(c => c[1]));
        const maxY = Math.max(...allCorners.map(c => c[1]));
        const strokeOffset = 1.5 / 2;

        bbox = {
          x: minX - strokeOffset,
          y: minY - strokeOffset,
          width: (maxX - minX) + (strokeOffset * 2),
          height: (maxY - minY) + (strokeOffset * 2),
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2
        };
      }

      let bboxWidth = bbox.width;
      let bboxHeight = bbox.height;
      let bboxCenterX = bbox.centerX;
      let bboxCenterY = bbox.centerY;
      let bboxMinY = bbox.centerY - bbox.height / 2;
      let bboxMaxY = bbox.centerY + bbox.height / 2;

      // In portrait mode with rotation, calculate the axis-aligned bounding box AFTER rotation
      if (isMobilePortrait && portraitActiveTree) {
        const rotations = {
          A: 86.174394,
          B: 59.784596,
          C: 0,
          D: -59.554601
        };
        const rotationDeg = rotations[portraitActiveTree];
        const rotationRad = (rotationDeg * Math.PI) / 180;

        // Rotate all visible corners around (0, 0) to find the new bounding box
        const rotatedCorners = allCorners.map((corner: number[]) => {
          const x = corner[0];
          const y = corner[1];
          const rotatedX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
          const rotatedY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
          return [rotatedX, rotatedY];
        });

        // Calculate axis-aligned bounding box of rotated corners
        const minX = Math.min(...rotatedCorners.map(c => c[0]));
        const maxX = Math.max(...rotatedCorners.map(c => c[0]));
        const minY = Math.min(...rotatedCorners.map(c => c[1]));
        const maxY = Math.max(...rotatedCorners.map(c => c[1]));

        // Update bbox dimensions and center
        bboxWidth = maxX - minX;
        bboxHeight = maxY - minY;
        bboxCenterX = (minX + maxX) / 2;
        bboxCenterY = (minY + maxY) / 2;
        bboxMinY = minY;
        bboxMaxY = maxY;
      }

      // Calculate zoom to fit bbox into window
      const zoomY = windowHeight / (bboxHeight * calculatedBaseScale);
      const zoomX = windowWidth / (bboxWidth * calculatedBaseScale);

      // In portrait mode, fit to width; in landscape mode, fit to height
      const initialZoom = isMobilePortrait ? zoomX : zoomY;

      // Calculate positions in pixels
      const bboxCenterInPixelsX = bboxCenterX * calculatedBaseScale * initialZoom;
      const bboxCenterInPixelsY = bboxCenterY * calculatedBaseScale * initialZoom;
      const bboxMaxYInPixels = bboxMaxY * calculatedBaseScale * initialZoom;

      // Pan calculation
      // Horizontally: center the bbox
      const initialPanX = (windowWidth / 2) - bboxCenterInPixelsX;

      // Vertically: in portrait mode, position first node's bottom just above the card; otherwise center
      let initialPanY: number;
      let finalPanX = initialPanX; // May be overridden for focused node centering
      if (isMobilePortrait && portraitActiveTree) {
        // Card height (use measured height or fallback to estimate)
        const cardHeight = portraitCardHeight || 180;
        const dotIndicatorHeight = 0; // Already included in cardHeight measurement
        const padding = 8; // Gap between first node and card
        const bottomReserved = cardHeight + dotIndicatorHeight + padding;
        const effectiveHeight = windowHeight - bottomReserved;

        // Find first node's bottom using same calculation as constrainPan and debug visualization
        const rotations: Record<string, number> = {
          A: 86.174394,
          B: 59.784596,
          C: 0,
          D: -59.554601
        };
        const rotationDeg = rotations[portraitActiveTree];
        const rotationRad = (rotationDeg * Math.PI) / 180;

        // Helper to get node's transformed position
        const getTransformedPos = (node: SkillNode) => {
          switch (node.tree) {
            case 'A': {
              const a = 0.82544171, b = 0.56448736, c = 0.56221371, d = -0.82211698, e = 81.266847, f = 463.85256;
              return { x: a * node.x + c * node.y + e, y: b * node.x + d * node.y + f };
            }
            case 'B':
            case 'C':
              return { x: node.x + 221.93716, y: node.y + 39.335736 };
            case 'D':
              return { x: -1 * node.x + 552.10903, y: node.y + 48.512262 };
            default:
              return { x: node.x, y: node.y };
          }
        };

        // Check if we have a focused node to center on
        const focusedNodeData = landscapeFocusedNodeRef.current;
        const focusedNode = focusedNodeData && focusedNodeData.tree === portraitActiveTree
          ? skillNodes.find(n => n.id === focusedNodeData.skillId)
          : null;

        if (focusedNode) {
          // Center view on the focused node
          const focusedTransformed = getTransformedPos(focusedNode);
          const focusedRotatedX = focusedTransformed.x * Math.cos(rotationRad) - focusedTransformed.y * Math.sin(rotationRad);
          const focusedRotatedY = focusedTransformed.x * Math.sin(rotationRad) + focusedTransformed.y * Math.cos(rotationRad);

          // Convert to pixels
          const focusedYInPixels = focusedRotatedY * calculatedBaseScale * initialZoom;

          // Calculate pan constraints (same logic as constrainPan for portrait mode)
          const treeNodes = skillNodes.filter(n => n.tree === portraitActiveTree);
          let maxRotatedY = -Infinity;
          let minRotatedY = Infinity;
          let firstNode = treeNodes[0];
          let topNode = treeNodes[0];

          treeNodes.forEach(node => {
            const transformed = getTransformedPos(node);
            const rotatedY = transformed.x * Math.sin(rotationRad) + transformed.y * Math.cos(rotationRad);
            if (rotatedY > maxRotatedY) {
              maxRotatedY = rotatedY;
              firstNode = node;
            }
            if (rotatedY < minRotatedY) {
              minRotatedY = rotatedY;
              topNode = node;
            }
          });

          // Calculate first node's bottom Y (including point container)
          const firstNodeTransformed = getTransformedPos(firstNode);
          const firstNodeRotatedY = firstNodeTransformed.x * Math.sin(rotationRad) + firstNodeTransformed.y * Math.cos(rotationRad);
          const pointContainerOffset = firstNode.radius + 2.0 + 3.5;
          const firstNodeBottomY = firstNodeRotatedY + pointContainerOffset;
          const firstNodeBottomInPixels = firstNodeBottomY * calculatedBaseScale * initialZoom;

          // Calculate top node's top Y
          const topNodeTransformed = getTransformedPos(topNode);
          const topNodeRotatedY = topNodeTransformed.x * Math.sin(rotationRad) + topNodeTransformed.y * Math.cos(rotationRad);
          const topNodeTopY = topNodeRotatedY - topNode.radius - topNode.radius;
          const topNodeTopInPixels = topNodeTopY * calculatedBaseScale * initialZoom;

          // Pan constraints
          const minPanY = effectiveHeight - firstNodeBottomInPixels;
          const topPadding = 16;
          const maxPanY = topPadding - topNodeTopInPixels;

          // Target: center focused node vertically in available space
          const targetScreenY = effectiveHeight / 2;
          let desiredPanY = targetScreenY - focusedYInPixels;

          // Apply constraints - always clamp to valid range
          // minPanY positions first node at bottom (just above card)
          // maxPanY positions top node at top of screen
          initialPanY = Math.max(minPanY, Math.min(maxPanY, desiredPanY));

          // X is always centered in portrait mode
          const bboxCenterInPixelsX = bboxCenterX * calculatedBaseScale * initialZoom;
          finalPanX = (windowWidth / 2) - bboxCenterInPixelsX;
        } else {
          // Default: position first node's bottom just above the card
          // Find node with highest Y (bottom) and lowest Y (top) in rotated coordinates
          const treeNodes = skillNodes.filter(n => n.tree === portraitActiveTree);
          let maxRotatedY = -Infinity;
          let minRotatedY = Infinity;
          let firstNode = treeNodes[0];
          let topNode = treeNodes[0];

          treeNodes.forEach(node => {
            const transformed = getTransformedPos(node);
            const rotatedY = transformed.x * Math.sin(rotationRad) + transformed.y * Math.cos(rotationRad);
            if (rotatedY > maxRotatedY) {
              maxRotatedY = rotatedY;
              firstNode = node;
            }
            if (rotatedY < minRotatedY) {
              minRotatedY = rotatedY;
              topNode = node;
            }
          });

          // Calculate first node's bottom Y in rotated space (including point container)
          const firstNodeTransformed = getTransformedPos(firstNode);
          const firstNodeRotatedY = firstNodeTransformed.x * Math.sin(rotationRad) + firstNodeTransformed.y * Math.cos(rotationRad);
          const pointContainerOffset = firstNode.radius + 2.0 + 3.5;
          const firstNodeBottomY = firstNodeRotatedY + pointContainerOffset;
          const firstNodeBottomInPixels = firstNodeBottomY * calculatedBaseScale * initialZoom;

          // Calculate top node's top Y
          const topNodeTransformed = getTransformedPos(topNode);
          const topNodeRotatedY = topNodeTransformed.x * Math.sin(rotationRad) + topNodeTransformed.y * Math.cos(rotationRad);
          const topNodeTopY = topNodeRotatedY - topNode.radius - topNode.radius;
          const topNodeTopInPixels = topNodeTopY * calculatedBaseScale * initialZoom;

          // Pan constraints (same as constrainPan)
          const minPanY = effectiveHeight - firstNodeBottomInPixels;
          const topPadding = 16;
          const maxPanY = topPadding - topNodeTopInPixels;

          // Target: position first node's bottom at effectiveHeight (top of card area)
          const desiredPanY = effectiveHeight - firstNodeBottomInPixels;

          // Apply constraints to ensure proper clamping
          initialPanY = Math.max(minPanY, Math.min(maxPanY, desiredPanY));
        }
      } else {
        initialPanY = (windowHeight / 2) - bboxCenterInPixelsY;  // Center vertically
      }

      setZoom(initialZoom);
      setInitialZoomLevel(initialZoom); // Store as minimum zoom for mobile
      setBaseScale(calculatedBaseScale); // Store base scale for blob calculations
      setPan({ x: finalPanX, y: initialPanY });

      // Store initial view for blob positioning
      setInitialView({
        pan: { x: finalPanX, y: initialPanY },
        zoom: initialZoom
      });

      // Wait for the next frame after the transform is applied
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsViewInitialized(true);
        });
      });
    };

    // Use requestAnimationFrame for clean DOM timing
    requestAnimationFrame(calculateInitialView);

    // Recalculate on window resize
    window.addEventListener('resize', calculateInitialView);
    return () => {
      window.removeEventListener('resize', calculateInitialView);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeSettings, portraitActiveTree, isMobilePortrait, treeBoundingBoxes, boundingBoxData, isFullscreen, portraitCardHeight]);
  // Note: portraitCardHeight is now included but we use portraitInitializedRef to prevent
  // re-initialization after the first calculation. This ensures we use the actual measured
  // card height on first init, but don't reset when the card resizes later.

  // Initial tree selection for portrait mode
  useEffect(() => {
    if (isMobilePortrait && !portraitActiveTree && configLoaded && treeSettings) {
      // Check if we have a previously focused node from orientation change
      const focusedNode = landscapeFocusedNodeRef.current;
      if (focusedNode) {
        // Use the focused node's tree and select it
        setPortraitActiveTree(focusedNode.tree);
        setSelectedPortraitSkillId(focusedNode.skillId);
      } else {
        // Find first visible tree in order A, B, C, D
        const firstVisible = (['A', 'B', 'C', 'D'] as const).find(
          (tree) => treeSettings[tree]?.visible !== false
        );
        setPortraitActiveTree(firstVisible || 'B');
      }
      // Clear any existing tooltip when entering portrait mode
      setTooltipData(null);
      setTooltipDimensions(null);
    } else if (!isMobilePortrait && portraitActiveTree) {
      // Reset when exiting portrait mode
      setPortraitActiveTree(null);
      setSelectedPortraitSkillId(null);
      // Note: Don't clear landscapeFocusedNodeRef here - we want to preserve it for landscape tooltip
    }
  }, [isMobilePortrait, treeSettings, portraitActiveTree, configLoaded]);

  // Handle landscape mode state changes
  useEffect(() => {
    if (!isMobileLandscape) {
      // Exiting landscape mode - clear landscape-specific state
      setTooltipData(null);
      setTooltipDimensions(null);
      setMobileToolbarOpen(false);
    } else {
      // Entering landscape mode
      setSelectedPortraitSkillId(null);

      // Show tooltip for the focused node if we have one
      const focusedNode = landscapeFocusedNodeRef.current;
      if (focusedNode) {
        // Set tooltip data - position will be calculated after DOM is ready
        // Use a small delay to ensure the view is rendered
        setTimeout(() => {
          // Find the node element in the DOM and get its position
          const nodeElement = document.querySelector(`[data-skill-id="${focusedNode.skillId}"]`);
          if (nodeElement) {
            const rect = nodeElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const screenRadius = rect.width / 2;

            // Store for tooltip repositioning
            (window as any).__tooltipNodeData = {
              x: centerX,
              y: centerY,
              radius: screenRadius,
              skillId: focusedNode.skillId
            };

            // Set tooltip (initially off-screen, will be repositioned by measure effect)
            setTooltipData({
              skillId: focusedNode.skillId,
              x: -10000,
              y: -10000,
              position: 'top-right',
              measured: false
            });
          }
        }, 100);
      }
    }
  }, [isMobileLandscape]);

  // Measure portrait card height dynamically - uses state instead of ref so effect re-runs when element is available
  useEffect(() => {
    if (!isMobilePortrait || !portraitCardNode) return;

    const measureCard = () => {
      if (portraitCardNode) {
        setPortraitCardHeight(portraitCardNode.offsetHeight);
      }
    };

    // Initial measurement
    measureCard();

    // Use ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(measureCard);
    resizeObserver.observe(portraitCardNode);

    return () => resizeObserver.disconnect();
  }, [isMobilePortrait, portraitCardNode]);

  // Auto-save configuration whenever nodeOverrides or treeSettings change (ONLY in edit mode)
  useEffect(() => {
    if (!configLoaded || !isEditMode) return; // Don't save on initial load or when not in edit mode

    const saveConfig = async () => {
      try {
        // Convert Map to object for JSON
        const nodeOverridesObj: Record<string, Partial<SkillNode>> = {};
        nodeOverrides.forEach((value, key) => {
          nodeOverridesObj[key] = value;
        });

        await fetch(`/api/config?mode=${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trees: treeSettings,
            nodeOverrides: nodeOverridesObj,
          }),
        });
      } catch (error) {
        // Silently fail - auto-save is not critical
      }
    };

    saveConfig();
  }, [nodeOverrides, treeSettings, configLoaded, mode, isEditMode]);

  // Get the effective node data (with overrides applied)
  const getEffectiveNodes = (): SkillNode[] => {
    return skillNodes.map(node => {
      const override = nodeOverrides.get(node.id);
      return override ? { ...node, ...override } : node;
    });
  };

  // Helper to check if a tree is visible
  const isTreeVisible = (tree: TreeType) => {
    // Portrait mode: only show active tree
    if (isMobilePortrait && portraitActiveTree) {
      return tree === portraitActiveTree;
    }

    // Normal mode: use tree settings
    return !treeSettings || treeSettings[tree]?.visible !== false;
  };

  // Calculate dynamic bounding box based on visible trees
  const getVisibleBoundingBox = useCallback(() => {
    const allCorners: number[][] = [];
    (['A', 'B', 'C', 'D'] as const).forEach(tree => {
      if (!isTreeVisible(tree)) return;

      const treeData = treeBoundingBoxes[tree];
      if (treeData && treeData.corners) {
        treeData.corners.forEach((corner: number[]) => {
          allCorners.push(corner);
        });
      }
    });

    if (allCorners.length === 0) {
      // Fallback to overall bounds if no trees visible
      return boundingBoxData.overallBoundingBox;
    }

    const minX = Math.min(...allCorners.map(c => c[0]));
    const maxX = Math.max(...allCorners.map(c => c[0]));
    const minY = Math.min(...allCorners.map(c => c[1]));
    const maxY = Math.max(...allCorners.map(c => c[1]));

    const strokeOffset = 1.5 / 2;

    return {
      x: minX - strokeOffset,
      y: minY - strokeOffset,
      width: (maxX - minX) + (strokeOffset * 2),
      height: (maxY - minY) + (strokeOffset * 2),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [treeSettings, isMobilePortrait, portraitActiveTree]);

  // Lightweight particles - optimized for performance
  // Particles spawn, drift, fade out, and get replaced to maintain constant count
  const particleCounter = useRef(0);
  const particleLifetimes = useRef<Map<string, number>>(new Map());

  const createParticle = (delay = 0) => {
    const id = `bokeh-${particleCounter.current++}`;

    // Use viewport-relative drift (percentage of screen) for consistent speed across devices
    // This ensures particles move at the same visual speed on mobile and desktop
    const minDriftPercent = 8; // 8% of viewport
    const maxDriftPercent = 15; // 15% of viewport
    const driftMagnitude = minDriftPercent + Math.random() * (maxDriftPercent - minDriftPercent);
    const angle = Math.random() * Math.PI * 2; // Random direction

    // Duration based on drift percentage - consistent timing regardless of screen size
    // ~1% per second gives a gentle, slow movement
    const driftSpeed = 0.8 + Math.random() * 0.5; // 0.8-1.3% per second
    const duration = driftMagnitude / driftSpeed;

    particleLifetimes.current.set(id, Date.now() + delay * 1000 + duration * 1000);

    // Size as percentage of viewport width for consistency
    // 0.5-1.0% of viewport width (roughly 10-20px on 1920px screen)
    const sizePercent = 0.5 + Math.random() * 0.5;

    // 15% of particles get direction changes via waypoints
    let waypoints: Array<{ x: number; y: number; percent: number }> | undefined;
    if (Math.random() < 0.15) {
      // Generate 1-2 waypoints for direction changes
      const numWaypoints = 1 + Math.floor(Math.random() * 2);
      waypoints = [];
      let currentX = 0;
      let currentY = 0;

      for (let i = 0; i < numWaypoints; i++) {
        // Each waypoint is at a percentage through the animation
        const percent = Math.round((20 + (i + 1) * (60 / (numWaypoints + 1))) + Math.random() * 10);
        // Add a direction change - new random angle
        const waypointAngle = Math.random() * Math.PI * 2;
        const waypointDrift = 3 + Math.random() * 5; // Smaller drift for each segment
        currentX += Math.cos(waypointAngle) * waypointDrift;
        currentY += Math.sin(waypointAngle) * waypointDrift;
        waypoints.push({ x: currentX, y: currentY, percent });
      }
    }

    const finalDriftX = Math.cos(angle) * driftMagnitude;
    const finalDriftY = Math.sin(angle) * driftMagnitude;

    return {
      id,
      sizePercent, // Store as percentage for vw units
      startX: Math.random() * 100,
      startY: Math.random() * 100,
      driftX: finalDriftX, // Now in viewport percentage
      driftY: finalDriftY, // Now in viewport percentage
      rotation: 0, // No rotation - simpler animation
      duration,
      delay,
      waypoints,
    };
  };

  // Track when particles were last paused to extend lifetimes
  const lastPauseTime = useRef<number | null>(null);

  // Combined pause state (either user paused or window inactive)
  const isPaused = particlesPaused || !isWindowActive;
  const isPausedRef = useRef(isPaused);

  // Handle pause/unpause - extend particle lifetimes when unpausing
  useEffect(() => {
    if (isPaused && !isPausedRef.current) {
      // Just became paused - record when we paused
      lastPauseTime.current = Date.now();
    } else if (!isPaused && isPausedRef.current && lastPauseTime.current !== null) {
      // Just became unpaused - extend all particle lifetimes by the pause duration
      const pauseDuration = Date.now() - lastPauseTime.current;
      particleLifetimes.current.forEach((expiry, id) => {
        particleLifetimes.current.set(id, expiry + pauseDuration);
      });
      lastPauseTime.current = null;
    }
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // Wait for tree to be displayed before spawning particles
    if (!minLoadingTimePassed || !isViewInitialized) return;

    const TARGET_PARTICLES = 6; // Particle count

    // Create initial particles with no delay - they start moving immediately
    // Each particle starts at a different point in its animation lifecycle
    setBokehParticles([...Array(TARGET_PARTICLES)].map(() =>
      createParticle(0) // No delay - particles move immediately on load
    ));

    // Check for expired particles and spawn replacements
    const interval = setInterval(() => {
      // Skip expiry check while paused - complete animation freeze (use ref to avoid re-render)
      if (isPausedRef.current) return;

      const now = Date.now();
      setBokehParticles(prev => {
        const activeParticles = prev.filter(p => {
          const expiry = particleLifetimes.current.get(p.id);
          return expiry && expiry > now;
        });

        // Add new particles to maintain target count
        const newParticles = [...activeParticles];
        while (newParticles.length < TARGET_PARTICLES) {
          newParticles.push(createParticle());
        }

        // Clean up expired entries from lifetime map
        particleLifetimes.current.forEach((expiry, id) => {
          if (expiry < now) {
            particleLifetimes.current.delete(id);
          }
        });

        return newParticles;
      });
    }, 4000); // Check every 4 seconds (less frequent for lower CPU usage)

    return () => clearInterval(interval);
  }, [minLoadingTimePassed, isViewInitialized]);

  // Track window visibility and focus to pause animations when inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsWindowActive(!document.hidden && document.hasFocus());
    };

    const handleFocus = () => {
      setIsWindowActive(!document.hidden);
    };

    const handleBlur = () => {
      setIsWindowActive(false);
    };

    // Don't set initial state - assume window is active on load
    // Only update when visibility/focus actually changes via events
    // This prevents the initial hasFocus() check from returning false during page load

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Helper function to constrain pan within boundaries
  const constrainPan = useCallback((newPan: { x: number; y: number }, currentZoom: number) => {
    if (!containerRef.current) return newPan;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = containerRef.current.clientWidth;
    const svgViewBoxWidth = 717.06897;
    const baseScale = containerWidth / svgViewBoxWidth;

    // Get dynamic bounding box based on visible trees
    let bbox = getVisibleBoundingBox();
    let bboxX = bbox.x;
    let bboxY = bbox.y;
    let bboxWidth = bbox.width;
    let bboxHeight = bbox.height;
    let bboxCenterX = bbox.centerX;
    let bboxCenterY = bbox.centerY;

    // Portrait mode: use rotated bounding box
    if (isMobilePortrait && portraitActiveTree) {
      const rotations: Record<string, number> = {
        A: 86.174394,
        B: 59.784596,
        C: 0,
        D: -59.554601
      };
      const rotationDeg = rotations[portraitActiveTree];
      const rotationRad = (rotationDeg * Math.PI) / 180;

      // Get the original bbox corners and rotate them
      const corners = [
        [bboxX, bboxY],
        [bboxX + bboxWidth, bboxY],
        [bboxX + bboxWidth, bboxY + bboxHeight],
        [bboxX, bboxY + bboxHeight]
      ];

      const rotatedCorners = corners.map(corner => {
        const x = corner[0];
        const y = corner[1];
        return [
          x * Math.cos(rotationRad) - y * Math.sin(rotationRad),
          x * Math.sin(rotationRad) + y * Math.cos(rotationRad)
        ];
      });

      const minX = Math.min(...rotatedCorners.map(c => c[0]));
      const maxX = Math.max(...rotatedCorners.map(c => c[0]));
      const minY = Math.min(...rotatedCorners.map(c => c[1]));
      const maxY = Math.max(...rotatedCorners.map(c => c[1]));

      bboxX = minX;
      bboxY = minY;
      bboxWidth = maxX - minX;
      bboxHeight = maxY - minY;
      bboxCenterX = (minX + maxX) / 2;
      bboxCenterY = (minY + maxY) / 2;
    }

    // Bounding box dimensions in pixels at current zoom
    const bboxPixelWidth = bboxWidth * baseScale * currentZoom;
    const bboxPixelHeight = bboxHeight * baseScale * currentZoom;

    // Bounding box top-left corner in pixels at current zoom (before pan)
    const bboxLeftInPixels = bboxX * baseScale * currentZoom;
    const bboxTopInPixels = bboxY * baseScale * currentZoom;

    // Calculate the actual position of bbox edges after pan
    const bboxLeft = newPan.x + bboxLeftInPixels;
    const bboxRight = bboxLeft + bboxPixelWidth;
    const bboxTop = newPan.y + bboxTopInPixels;
    const bboxBottom = bboxTop + bboxPixelHeight;

    // Constrain so bbox stays within viewport
    let constrainedX = newPan.x;
    let constrainedY = newPan.y;

    // Portrait mode: special handling for vertical scrolling
    if (isMobilePortrait && portraitActiveTree) {
      // Keep horizontal centered
      const bboxCenterInPixelsX = bboxCenterX * baseScale * currentZoom;
      constrainedX = (windowWidth / 2) - bboxCenterInPixelsX;

      // Account for card height at bottom
      const cardHeight = portraitCardHeight || 180;
      const dotIndicatorHeight = 0; // Already included in cardHeight measurement
      const padding = 8; // Gap between first node and card
      const bottomReserved = cardHeight + dotIndicatorHeight + padding;
      const effectiveHeight = windowHeight - bottomReserved;

      // Find the first node's bottom in rotated coordinates (same logic as debug visualization)
      const rotations: Record<string, number> = {
        A: 86.174394,
        B: 59.784596,
        C: 0,
        D: -59.554601
      };
      const rotationDeg = rotations[portraitActiveTree];
      const rotationRad = (rotationDeg * Math.PI) / 180;

      // Helper to get node's transformed position (same as getNodeTransformedPosition)
      const getTransformedPos = (node: SkillNode) => {
        switch (node.tree) {
          case 'A': {
            const a = 0.82544171, b = 0.56448736, c = 0.56221371, d = -0.82211698, e = 81.266847, f = 463.85256;
            return { x: a * node.x + c * node.y + e, y: b * node.x + d * node.y + f };
          }
          case 'B':
          case 'C':
            return { x: node.x + 221.93716, y: node.y + 39.335736 };
          case 'D':
            return { x: -1 * node.x + 552.10903, y: node.y + 48.512262 };
          default:
            return { x: node.x, y: node.y };
        }
      };

      // Find the node with highest Y (bottom) and lowest Y (top) in the ROTATED coordinate system
      const treeNodes = skillNodes.filter(n => n.tree === portraitActiveTree);
      let maxRotatedY = -Infinity;
      let minRotatedY = Infinity;
      let firstNode = treeNodes[0];
      let topNode = treeNodes[0];

      treeNodes.forEach(node => {
        const transformed = getTransformedPos(node);
        const rotatedY = transformed.x * Math.sin(rotationRad) + transformed.y * Math.cos(rotationRad);
        if (rotatedY > maxRotatedY) {
          maxRotatedY = rotatedY;
          firstNode = node;
        }
        if (rotatedY < minRotatedY) {
          minRotatedY = rotatedY;
          topNode = node;
        }
      });

      // Calculate first node's bottom Y in rotated space (including point container)
      const firstNodeTransformed = getTransformedPos(firstNode);
      const firstNodeRotatedY = firstNodeTransformed.x * Math.sin(rotationRad) + firstNodeTransformed.y * Math.cos(rotationRad);
      const pointContainerOffset = firstNode.radius + 2.0 + 3.5; // Same as debug
      const firstNodeBottomY = firstNodeRotatedY + pointContainerOffset;

      // Calculate top node's top Y in rotated space (subtract radius for the top edge, then add radius as padding)
      const topNodeTransformed = getTransformedPos(topNode);
      const topNodeRotatedY = topNodeTransformed.x * Math.sin(rotationRad) + topNodeTransformed.y * Math.cos(rotationRad);
      const topNodeTopY = topNodeRotatedY - topNode.radius - topNode.radius; // radius for edge + radius for padding

      // Convert to pixels
      const firstNodeBottomInPixels = firstNodeBottomY * baseScale * currentZoom;
      const topNodeTopInPixels = topNodeTopY * baseScale * currentZoom;

      // minPanY: first node's bottom should sit just above the card (effectiveHeight)
      // When panY = minPanY, firstNodeBottomInPixels should be at effectiveHeight
      const minPanY = effectiveHeight - firstNodeBottomInPixels;

      // maxPanY: top node's top should not go below top of screen + padding
      const topPadding = 16;
      const maxPanYFromTopNode = topPadding - topNodeTopInPixels;

      // maxPanY is the scroll down limit (when top node reaches screen top)
      const maxPanY = maxPanYFromTopNode;

      // Always clamp to valid range
      // minPanY: positions first node's bottom just above the card (scroll limit when going UP)
      // maxPanY: positions top node at top of screen with padding (scroll limit when going DOWN)
      // If tree fits entirely, minPanY and maxPanY will be close, naturally limiting scroll
      constrainedY = Math.max(minPanY, Math.min(maxPanY, newPan.y));

      return { x: constrainedX, y: constrainedY };
    }

    // If bbox is wider than viewport, prevent edges from showing
    if (bboxPixelWidth >= windowWidth) {
      // Don't allow right edge to go past left of viewport
      if (bboxRight < windowWidth) {
        constrainedX = windowWidth - bboxPixelWidth - bboxLeftInPixels;
      }
      // Don't allow left edge to go past right of viewport
      if (bboxLeft > 0) {
        constrainedX = -bboxLeftInPixels;
      }
    } else {
      // Bbox is narrower than viewport, center it
      const bboxCenterInPixelsX = bboxCenterX * baseScale * currentZoom;
      constrainedX = (windowWidth / 2) - bboxCenterInPixelsX;
    }

    // If bbox is taller than viewport, prevent edges from showing
    if (bboxPixelHeight >= windowHeight) {
      // Don't allow bottom edge to go past top of viewport
      if (bboxBottom < windowHeight) {
        constrainedY = windowHeight - bboxPixelHeight - bboxTopInPixels;
      }
      // Don't allow top edge to go past bottom of viewport
      if (bboxTop > 0) {
        constrainedY = -bboxTopInPixels;
      }
    } else {
      // Bbox is shorter than viewport, center it
      const bboxCenterInPixelsY = bboxCenterY * baseScale * currentZoom;
      constrainedY = (windowHeight / 2) - bboxCenterInPixelsY;
    }

    return { x: constrainedX, y: constrainedY };
  }, [getVisibleBoundingBox, isMobilePortrait, portraitCardHeight, portraitActiveTree]);


  // Zoom and Pan handlers
  const handleWheel = useCallback((e: React.WheelEvent | WheelEvent) => {
    e.preventDefault();

    // Disable zoom in mobile portrait mode
    if (isMobilePortrait) return;

    if (!containerRef.current) return;

    // Calculate minimum zoom based on window height
    const windowHeight = window.innerHeight;
    const containerWidth = containerRef.current.clientWidth;
    const svgViewBoxWidth = 717.06897;
    const baseScale = containerWidth / svgViewBoxWidth;

    // Get dynamic bounding box based on visible trees
    const bbox = getVisibleBoundingBox();

    // Minimum zoom to keep height filling the window
    const minZoom = windowHeight / (bbox.height * baseScale);

    // Check if this is a pinch zoom (Ctrl key is pressed on trackpad pinch)
    const isPinchZoom = e.ctrlKey;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.min(Math.max(minZoom, zoom + delta), 2);

    // Calculate mouse position in viewport
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate the point in the content that's currently under the mouse
    // Account for current pan and zoom
    const contentX = (mouseX - pan.x) / zoom;
    const contentY = (mouseY - pan.y) / zoom;

    // After zooming, we want the same content point to be under the mouse
    // newPan + contentPoint * newZoom = mousePosition
    const newPanX = mouseX - contentX * newZoom;
    const newPanY = mouseY - contentY * newZoom;

    // Constrain pan to keep bbox within viewport
    const constrainedPan = constrainPan({ x: newPanX, y: newPanY }, newZoom);

    setPan(constrainedPan);
    setZoom(newZoom);
  }, [zoom, pan, setPan, setZoom, getVisibleBoundingBox, constrainPan, isMobilePortrait]);

  // Attach wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.addEventListener('wheel', handleWheel as any, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel as any);
    };
  }, [handleWheel]);

  // Navigate between trees in portrait mode
  const navigateToTree = (direction: 'left' | 'right') => {
    if (!portraitActiveTree) return;

    // Full tree order: A → B → C → D
    const allTrees: TreeType[] = ['A', 'B', 'C', 'D'];

    // Filter to only visible trees
    const visibleTrees = allTrees.filter(
      (tree) => !treeSettings || treeSettings[tree]?.visible !== false
    );

    const currentIndex = visibleTrees.indexOf(portraitActiveTree);
    if (currentIndex === -1) return;

    let newTree: TreeType | null = null;

    if (direction === 'left') {
      // Swipe left: move forward (A → B → C → D)
      if (currentIndex < visibleTrees.length - 1) {
        newTree = visibleTrees[currentIndex + 1];
      }
    } else {
      // Swipe right: move backward (D → C → B → A)
      if (currentIndex > 0) {
        newTree = visibleTrees[currentIndex - 1];
      }
    }

    if (newTree) {
      // Enable smooth transition
      setIsTreeTransitioning(true);
      setPortraitActiveTree(newTree);
      // Clear selection when switching trees
      setSelectedPortraitSkillId(null);
      // Clear hover state to remove yellow highlight
      setHoveredSkill(null);
      // Clear focused node so rotation uses default behavior
      landscapeFocusedNodeRef.current = null;
      // Disable transition flag after animation completes
      setTimeout(() => setIsTreeTransitioning(false), 400);
    }
  };

  // Touch handlers: handle swipe gestures for tree navigation and pinch-to-zoom for landscape
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Helper to calculate distance between two touch points
    const getTouchDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Helper to get center point between two touches
    const getTouchCenter = (touches: TouchList): { x: number; y: number } => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && isMobileLandscape) {
        // Two-finger touch: initialize pinch-to-zoom
        setLastTouchDistance(getTouchDistance(e.touches));
        setLastTouchCenter(getTouchCenter(e.touches));
        setIsTouchPanning(true);
      } else if (e.touches.length === 1) {
        // Single touch: store for swipe detection or single-finger pan
        setTouchStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
        if (isMobileLandscape || isMobilePortrait) {
          setIsTouchPanning(true);
          setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Portrait mode: only allow vertical panning
      if (isMobilePortrait && e.touches.length === 1 && isTouchPanning && lastTouchCenter) {
        const deltaY = e.touches[0].clientY - lastTouchCenter.y;
        const deltaX = e.touches[0].clientX - lastTouchCenter.x;

        // Only pan vertically if movement is more vertical than horizontal
        // This prevents accidental vertical pan during horizontal swipe
        if (Math.abs(deltaY) > Math.abs(deltaX) * 0.5) {
          if (e.cancelable) e.preventDefault();

          // Only update Y, keep X centered
          const newPan = {
            x: pan.x, // Keep X unchanged (centered)
            y: pan.y + deltaY,
          };

          // Constrain vertical pan to tree boundaries
          const constrainedPan = constrainPan(newPan, zoom);
          setPan(constrainedPan);
        }

        setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        return;
      }

      if (!isMobileLandscape) return;

      if (e.touches.length === 2 && lastTouchDistance !== null) {
        // Pinch-to-zoom
        if (e.cancelable) e.preventDefault();
        const newDistance = getTouchDistance(e.touches);
        const newCenter = getTouchCenter(e.touches);

        // Calculate zoom change - use initialZoomLevel as minimum to prevent zooming out beyond initial view
        const scale = newDistance / lastTouchDistance;
        const newZoom = Math.min(Math.max(zoom * scale, initialZoomLevel), 3);

        // Calculate pan to keep the pinch center point stable
        if (lastTouchCenter) {
          const contentX = (lastTouchCenter.x - pan.x) / zoom;
          const contentY = (lastTouchCenter.y - pan.y) / zoom;

          const newPanX = newCenter.x - contentX * newZoom;
          const newPanY = newCenter.y - contentY * newZoom;

          const constrainedPan = constrainPan({ x: newPanX, y: newPanY }, newZoom);
          setPan(constrainedPan);
        }

        setZoom(newZoom);
        setLastTouchDistance(newDistance);
        setLastTouchCenter(newCenter);
      } else if (e.touches.length === 1 && isTouchPanning && lastTouchCenter) {
        // Single-finger pan
        if (e.cancelable) e.preventDefault();
        const deltaX = e.touches[0].clientX - lastTouchCenter.x;
        const deltaY = e.touches[0].clientY - lastTouchCenter.y;

        const newPan = {
          x: pan.x + deltaX,
          y: pan.y + deltaY,
        };
        const constrainedPan = constrainPan(newPan, zoom);
        setPan(constrainedPan);

        setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Handle swipe for portrait mode tree navigation
      if (touchStart && isMobilePortrait && e.changedTouches.length > 0) {
        const touchEnd = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };

        const deltaX = touchEnd.x - touchStart.x;
        const deltaY = touchEnd.y - touchStart.y;

        // Horizontal swipe detection (swipe must be more horizontal than vertical)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
          if (deltaX < 0) {
            // Swipe left: move forward (B → C → D)
            navigateToTree('left');
          } else {
            // Swipe right: move backward (D → C → B)
            navigateToTree('right');
          }
        }
      }

      // In mobile landscape mode, dismiss tooltip when tapping on empty space (short tap, no move)
      if (isMobileLandscape && touchStart && e.changedTouches.length > 0) {
        const touchEnd = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };
        const deltaX = Math.abs(touchEnd.x - touchStart.x);
        const deltaY = Math.abs(touchEnd.y - touchStart.y);

        // If it was a tap (minimal movement) on empty space
        if (deltaX < 10 && deltaY < 10) {
          const target = e.target as HTMLElement;
          // Only dismiss if not tapping on a node or other interactive element
          if (target.tagName === 'DIV' || target.tagName === 'svg') {
            setTooltipData(null);
            setTooltipDimensions(null);
            (window as any).__tooltipNodeData = null;
            // Clear focused node so rotation uses default behavior
            landscapeFocusedNodeRef.current = null;
          }
        }
      }

      // In mobile portrait mode, clear selection when tapping on empty space (short tap, no move)
      if (isMobilePortrait && touchStart && e.changedTouches.length > 0) {
        const touchEnd = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };
        const deltaX = Math.abs(touchEnd.x - touchStart.x);
        const deltaY = Math.abs(touchEnd.y - touchStart.y);

        // If it was a tap (minimal movement) on empty space
        if (deltaX < 10 && deltaY < 10) {
          const target = e.target as HTMLElement;
          // Only dismiss if not tapping on a node or other interactive element
          if (target.tagName === 'DIV' || target.tagName === 'svg') {
            setSelectedPortraitSkillId(null);
            // Clear focused node so rotation uses default behavior
            landscapeFocusedNodeRef.current = null;
          }
        }
      }

      // Reset touch state
      if (e.touches.length === 0) {
        setTouchStart(null);
        setLastTouchDistance(null);
        setLastTouchCenter(null);
        setIsTouchPanning(false);
      } else if (e.touches.length === 1) {
        // Switched from two fingers to one
        setLastTouchDistance(null);
        setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, isMobilePortrait, isMobileLandscape, portraitActiveTree, navigateToTree, lastTouchDistance, lastTouchCenter, isTouchPanning, zoom, pan, constrainPan, initialZoomLevel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Disable panning in portrait mode to prevent conflicts with swipe gestures
    if (isMobilePortrait) return;

    // Only pan with middle mouse button or left click on background
    if (e.button === 1 || (e.button === 0 && (e.target as HTMLElement).tagName === 'DIV')) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });

      // In mobile landscape mode, clicking on empty space dismisses the tooltip
      if (isMobileLandscape && tooltipData) {
        setTooltipData(null);
        setTooltipDimensions(null);
        (window as any).__tooltipNodeData = null;
        // Clear focused node so rotation uses default behavior
        landscapeFocusedNodeRef.current = null;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newPan = {
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      };
      // Constrain pan to keep bbox within viewport
      const constrainedPan = constrainPan(newPan, zoom);
      setPan(constrainedPan);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Toggle fullscreen mode for immersive mobile experience
  const toggleFullscreen = async () => {
    const doc = document.documentElement;

    if (isFullscreen) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } else {
      // Enter fullscreen
      if (doc.requestFullscreen) {
        await doc.requestFullscreen().catch(() => {});
      } else if ((doc as any).webkitRequestFullscreen) {
        (doc as any).webkitRequestFullscreen();
      } else if ((doc as any).mozRequestFullScreen) {
        (doc as any).mozRequestFullScreen();
      } else if ((doc as any).msRequestFullscreen) {
        (doc as any).msRequestFullscreen();
      }
    }
  };

  const handleNodeClick = (skillId: string, event?: React.MouseEvent) => {
    const node = effectiveNodes.find(n => n.id === skillId);
    if (!node) return;

    // In edit mode, open the editor with effective node (with overrides)
    if (isEditMode) {
      setEditingNode(node);
      return;
    }

    // In mobile portrait mode, select the skill for the bottom card
    if (isMobilePortrait) {
      // Always select the clicked skill (clicking same skill keeps it selected)
      setSelectedPortraitSkillId(skillId);
      // Update the ref so this selection persists across orientation changes
      landscapeFocusedNodeRef.current = { skillId, tree: node.tree };
      return;
    }

    // In mobile landscape mode, just toggle/update the tooltip (points modified via tooltip buttons)
    if (isMobileLandscape) {
      // If clicking the same node that's already showing tooltip, keep it open
      // If clicking a different node, update tooltip to that node
      if (tooltipData?.skillId !== skillId && event) {
        const rect = (event.target as SVGElement).getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const screenRadius = rect.width / 2;
        handleNodeHover(skillId, centerX, centerY, screenRadius);
      }
      return;
    }

    const currentPoints = getSkillPoints(skillId);
    const totalTreePoints = getTotalTreePoints(node.tree);
    const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

    // Right-click or Shift+click to remove point
    if (event && (event.button === 2 || event.shiftKey)) {
      if (canRemovePoint(skillId, state.skillPoints, effectiveNodes)) {
        removePoint(skillId);
      }
    } else {
      // Left-click to add point
      if (canAddPoint(node, state.skillPoints, totalTreePoints, effectiveNodes)) {
        // Check if we're at max points before adding
        if (isAtMaxPoints()) {
          // Trigger flash animation
          setIsMaxPointsFlash(true);
          setTimeout(() => setIsMaxPointsFlash(false), 400);
        } else {
          addPoint(skillId);
        }
      } else if (isAtMaxPoints()) {
        // Skill can't be added and we're at max points - flash
        setIsMaxPointsFlash(true);
        setTimeout(() => setIsMaxPointsFlash(false), 400);
      }
    }
  };

  const handleSaveNode = (updatedNode: Partial<SkillNode>) => {
    if (!editingNode) return;

    // Update local state - auto-save will trigger
    const newMap = new Map(nodeOverrides);
    const existing = newMap.get(editingNode.id) || {};
    newMap.set(editingNode.id, { ...existing, ...updatedNode });
    setNodeOverrides(newMap);
  };

  const handleSaveTreeSettings = (newTreeSettings: Record<TreeType, TreeSettingsType>) => {
    setTreeSettings(newTreeSettings); // Auto-save will trigger
    setTreeSettingsVersion(v => v + 1); // Force re-render of bottom connectors
  };

  const handleExportConfig = () => {
    if (!treeSettings) return;
    const effectiveNodes = getEffectiveNodes();
    const config = exportConfig(effectiveNodes, treeSettings);
    downloadConfigAsJson(config);
  };

  const handleCopyConfig = async () => {
    if (!treeSettings) return;
    try {
      const effectiveNodes = getEffectiveNodes();
      const config = exportConfig(effectiveNodes, treeSettings);
      await copyConfigToClipboard(config);
      alert('Configuration copied to clipboard!');
    } catch (error) {
      alert('Failed to copy configuration to clipboard');
    }
  };

  const handleLoadConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const config = await loadConfigFromJson(file);

      // Apply node overrides from loaded configuration
      if (config.nodes && Array.isArray(config.nodes)) {
        const newOverrides = new Map<string, Partial<SkillNode>>();

        config.nodes.forEach(loadedNode => {
          const originalNode = skillNodes.find(n => n.id === loadedNode.id);
          if (originalNode) {
            // Calculate what changed from the original
            const changes: Partial<SkillNode> = {};
            if (loadedNode.name !== originalNode.name) changes.name = loadedNode.name;
            if (loadedNode.description !== originalNode.description) changes.description = loadedNode.description;
            if (loadedNode.maxPoints !== originalNode.maxPoints) changes.maxPoints = loadedNode.maxPoints;
            if (loadedNode.pointsRequiredInTree !== originalNode.pointsRequiredInTree) changes.pointsRequiredInTree = loadedNode.pointsRequiredInTree;
            if (loadedNode.iconPath !== originalNode.iconPath) changes.iconPath = loadedNode.iconPath;

            if (Object.keys(changes).length > 0) {
              newOverrides.set(loadedNode.id, changes);
            }
          }
        });

        setNodeOverrides(newOverrides);
      }

      if (config.trees) {
        setTreeSettings(config.trees);
      }

      alert(`Configuration loaded successfully!\nVersion: ${config.version}\nTimestamp: ${new Date(config.timestamp).toLocaleString()}`);
    } catch (error) {
      alert('Failed to load configuration. Please check the file format.');
    }

    // Reset file input
    event.target.value = '';
  };

  const handleNodeHover = (skillId: string | null, x?: number, y?: number, radius?: number) => {
    setHoveredSkill(skillId);
    // Don't show tooltips in mobile portrait mode - use MobilePortraitCard instead
    if (isMobilePortrait) {
      return;
    }
    if (skillId && x !== undefined && y !== undefined && radius !== undefined) {
      // Store node position and radius for repositioning after measurement
      (window as any).__tooltipNodeData = { x, y, radius, skillId };

      // Track focused node in landscape mode for orientation change
      if (isMobileLandscape) {
        const node = skillNodes.find(n => n.id === skillId);
        if (node) {
          landscapeFocusedNodeRef.current = { skillId, tree: node.tree };
        }
      }

      // First render invisibly to measure
      setTooltipData({
        skillId,
        x: -10000, // Off-screen
        y: -10000,
        position: 'top-right',
        measured: false
      });
    } else {
      // In mobile landscape mode, don't dismiss tooltip on hover out
      // Tooltip is only dismissed by clicking empty space or another node
      if (isMobileLandscape && tooltipData) {
        return;
      }
      setTooltipData(null);
      setTooltipDimensions(null);
      (window as any).__tooltipNodeData = null;
    }
  };

  const handleTooltipMeasure = (width: number, height: number) => {
    if (!tooltipData || tooltipData.measured) return;

    const nodeData = (window as any).__tooltipNodeData;
    if (!nodeData) return;

    // Make sure we're measuring the tooltip for the current hovered skill
    if (nodeData.skillId !== tooltipData.skillId) return;

    const { x, y, radius } = nodeData;
    const spacing = 20; // 20px in screen space from the outer edge
    const padding = 20; // Additional padding from viewport edges

    const tooltipWidth = width;
    const tooltipHeight = height;

    // Determine best position based on available space
    let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center-right' | 'center-left' = 'top-right';
    let tooltipX: number;
    let tooltipY: number;

    // Check available space in each direction
    const spaceRight = window.innerWidth - x - radius;
    const spaceLeft = x - radius;
    const spaceTop = y - radius;
    const spaceBottom = window.innerHeight - y - radius;

    // Determine horizontal position
    const needsWidth = tooltipWidth + spacing + padding;
    const canFitRight = spaceRight >= needsWidth;
    const canFitLeft = spaceLeft >= needsWidth;

    // Determine vertical position
    const needsHeight = tooltipHeight + spacing + padding;
    const canFitTop = spaceTop >= needsHeight;
    const canFitBottom = spaceBottom >= needsHeight;

    // Choose best position (prefer right side, vertically centered if possible)
    // When enough space on both top and bottom, center the tooltip vertically with the node
    const reducedSpacing = spacing / 4; // Use reduced spacing when moving vertically (5px)
    if (canFitRight) {
      if (canFitTop && canFitBottom) {
        // Enough space both ways - center vertically
        position = 'center-right';
        tooltipX = x + radius + spacing;
        // Center the tooltip: node center Y minus half tooltip height
        tooltipY = y - (tooltipHeight / 2);
      } else if (canFitTop) {
        position = 'top-right';
        tooltipX = x + radius + reducedSpacing;
        tooltipY = y - radius - reducedSpacing;
      } else {
        position = 'bottom-right';
        tooltipX = x + radius + reducedSpacing;
        tooltipY = y + radius + reducedSpacing;
      }
    } else if (canFitLeft) {
      if (canFitTop && canFitBottom) {
        // Enough space both ways - center vertically
        position = 'center-left';
        tooltipX = x - radius - spacing - tooltipWidth;
        // Center the tooltip: node center Y minus half tooltip height
        tooltipY = y - (tooltipHeight / 2);
      } else if (canFitTop) {
        position = 'top-left';
        tooltipX = x - radius - reducedSpacing - tooltipWidth;
        tooltipY = y - radius - reducedSpacing;
      } else {
        position = 'bottom-left';
        tooltipX = x - radius - reducedSpacing - tooltipWidth;
        tooltipY = y + radius + reducedSpacing;
      }
    } else {
      // Fallback: try to fit wherever there's most space
      // Use reduced spacing (50%) when repositioning in both directions
      const reducedSpacing = spacing / 2;
      if (spaceBottom >= spaceTop) {
        position = spaceRight >= spaceLeft ? 'bottom-right' : 'bottom-left';
        tooltipX = spaceRight >= spaceLeft ? x + radius + reducedSpacing : x - radius - reducedSpacing - tooltipWidth;
        tooltipY = y + radius + reducedSpacing;
      } else {
        position = spaceRight >= spaceLeft ? 'top-right' : 'top-left';
        tooltipX = spaceRight >= spaceLeft ? x + radius + reducedSpacing : x - radius - reducedSpacing - tooltipWidth;
        tooltipY = y - radius - reducedSpacing;
      }
    }

    setTooltipData({ skillId: tooltipData.skillId, x: tooltipX, y: tooltipY, position, measured: true });
    setTooltipDimensions({ width, height });
  };

  const handleCopyUrl = async () => {
    try {
      await copyShareUrl();
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // Silently fail
    }
  };

  // Get effective nodes with overrides applied
  const effectiveNodes = getEffectiveNodes();

  // Re-constrain pan when card height changes - adjust based on two conditions:
  // 1. Node under card: scroll UP to place node just above card
  // 2. Tree bottom above card: scroll DOWN to keep tree bottom at card line
  useEffect(() => {
    if (!isMobilePortrait || !portraitCardHeight || !portraitActiveTree) return;

    // Only adjust if card height actually changed
    const prevHeight = prevPortraitCardHeightRef.current;
    if (prevHeight === portraitCardHeight) return;

    prevPortraitCardHeightRef.current = portraitCardHeight;

    // Portrait mode rotation angles for each tree (to make them vertical)
    const rotations: Record<string, number> = {
      A: 86.174394,
      B: 59.784596,
      C: 0,
      D: -59.554601
    };
    const rotationDeg = rotations[portraitActiveTree];
    const rotationRad = (rotationDeg * Math.PI) / 180;

    // Helper to get node's transformed position
    const getTransformedPos = (node: SkillNode) => {
      switch (node.tree) {
        case 'A': {
          const a = 0.82544171, b = 0.56448736, c = 0.56221371, d = -0.82211698, e = 81.266847, f = 463.85256;
          return { x: a * node.x + c * node.y + e, y: b * node.x + d * node.y + f };
        }
        case 'B':
        case 'C':
          return { x: node.x + 221.93716, y: node.y + 39.335736 };
        case 'D':
          return { x: -1 * node.x + 552.10903, y: node.y + 48.512262 };
        default:
          return { x: node.x, y: node.y };
      }
    };

    // Find the bottom-most node in the rotated coordinate system
    const treeNodes = effectiveNodes.filter(n => n.tree === portraitActiveTree);
    let maxRotatedY = -Infinity;
    let bottomNode = treeNodes[0];

    treeNodes.forEach(node => {
      const transformed = getTransformedPos(node);
      const rotatedY = transformed.x * Math.sin(rotationRad) + transformed.y * Math.cos(rotationRad);
      if (rotatedY > maxRotatedY) {
        maxRotatedY = rotatedY;
        bottomNode = node;
      }
    });

    // Calculate bottom node's bottom Y in rotated space (including point container)
    const bottomNodeTransformed = getTransformedPos(bottomNode);
    const bottomNodeRotatedY = bottomNodeTransformed.x * Math.sin(rotationRad) + bottomNodeTransformed.y * Math.cos(rotationRad);
    const treePointContainerOffset = bottomNode.radius + 2.0 + 3.5;
    const treeBottomY = bottomNodeRotatedY + treePointContainerOffset;

    const screenHeight = window.innerHeight;
    const padding = 8;
    const cardTopY = screenHeight - portraitCardHeight - padding;
    const margin = 8; // Small margin above card line

    setPan(currentPan => {
      let newPanY = currentPan.y;
      let needsAdjustment = false;

      // Condition 1: Check if selected node is under the card → Scroll UP
      if (selectedPortraitSkillId) {
        const selectedNode = effectiveNodes.find(n => n.id === selectedPortraitSkillId);
        if (selectedNode) {
          const transformed = getTransformedPos(selectedNode);
          const rotatedY = transformed.x * Math.sin(rotationRad) + transformed.y * Math.cos(rotationRad);
          // Include point container in node bottom calculation
          const nodePointContainerOffset = selectedNode.radius + 2.0 + 3.5;
          const nodeBottomY = rotatedY + nodePointContainerOffset;
          const nodeBottomScreenY = nodeBottomY * baseScale * zoom + currentPan.y;

          if (nodeBottomScreenY > cardTopY) {
            // Node is under card, calculate exact adjustment to place just above card
            const adjustment = nodeBottomScreenY - cardTopY + margin;
            newPanY = currentPan.y - adjustment; // Scroll UP (decrease panY)
            needsAdjustment = true;

            // Check if scrolling UP would push tree bottom above card
            // If so, limit the scroll to keep tree bottom at card line
            const treeBottomScreenYAfterAdjust = treeBottomY * baseScale * zoom + newPanY;
            if (treeBottomScreenYAfterAdjust < cardTopY) {
              // Scrolling up too much would create a gap, limit to keep tree bottom at card
              newPanY = cardTopY - treeBottomY * baseScale * zoom;
            }
          }
        }
      }

      // Condition 2: Check if tree bottom is above the card line → Scroll DOWN
      // This applies even if Condition 1 didn't trigger (e.g., when card expands and pushes tree up)
      if (!needsAdjustment) {
        const treeBottomScreenY = treeBottomY * baseScale * zoom + currentPan.y;
        if (treeBottomScreenY < cardTopY) {
          // Tree bottom is above card (gap exists), scroll DOWN to keep tree bottom at card line
          newPanY = cardTopY - treeBottomY * baseScale * zoom;
          needsAdjustment = true;
        }
      }

      if (needsAdjustment) {
        // Apply constrain and return adjusted pan
        const newPan = { x: currentPan.x, y: newPanY };
        return constrainPan(newPan, zoom);
      }

      // Even if no adjustment needed, always apply constrainPan to ensure proper clamping
      // This handles cases where initial view used fallback card height
      return constrainPan(currentPan, zoom);
    });
  }, [portraitCardHeight, isMobilePortrait, constrainPan, zoom, setPan, selectedPortraitSkillId, effectiveNodes, baseScale, pan.y, portraitActiveTree]);

  // Filter nodes and paths based on tree visibility (includes portrait mode logic)
  const filteredNodes = effectiveNodes.filter((node) => {
    return isTreeVisible(node.tree);
  });

  const filteredPaths = skillPaths.filter((path) => {
    return isTreeVisible(path.tree);
  });

  const isPathUnlocked = (pathId: string) => {
    const path = skillPaths.find((p) => p.id === pathId);
    if (!path) return false;
    const fromPoints = getSkillPoints(path.from);
    const toPoints = getSkillPoints(path.to);
    return fromPoints > 0 && toPoints > 0;
  };

  const isPathPartiallyUnlocked = (pathId: string) => {
    const path = skillPaths.find((p) => p.id === pathId);
    if (!path) return false;
    const fromPoints = getSkillPoints(path.from);
    const toPoints = getSkillPoints(path.to);
    return fromPoints > 0 || toPoints > 0;
  };

  const shouldColorPath = (pathId: string) => {
    // Color path if the "from" node has points allocated and leads to an available or locked node
    const path = skillPaths.find((p) => p.id === pathId);
    if (!path) return false;

    const fromNode = effectiveNodes.find((n) => n.id === path.from);
    const toNode = effectiveNodes.find((n) => n.id === path.to);
    if (!fromNode || !toNode) return false;

    // Check if "from" node has at least one point allocated
    const fromPoints = getSkillPoints(path.from);
    if (fromPoints === 0) return false;

    const totalTreePoints = getTotalTreePoints(fromNode.tree);
    const toState = getSkillState(toNode, state.skillPoints, totalTreePoints, effectiveNodes);

    // Color if "from" node has points and "to" node is available or locked
    const toIsAvailableOrLocked = toState === 'available' || toState === 'locked' || toState === 'unlocked';

    return toIsAvailableOrLocked;
  };


  // Check if bottom connector path should be colored (paths leading TO tier 0 nodes from bottom)
  const shouldColorBottomPath = (tree: TreeType) => {
    // Check tree visibility first
    if (!isTreeVisible(tree)) return false;

    // Find the tier 0 node for this tree
    const tier0Node = effectiveNodes.find((n) => n.tree === tree && n.tier === 0);
    if (!tier0Node) {
      return false;
    }

    const totalTreePoints = getTotalTreePoints(tree);
    const nodeState = getSkillState(tier0Node, state.skillPoints, totalTreePoints, effectiveNodes);
    const result = nodeState === 'available' || nodeState === 'unlocked';

    return result;
  };

  // Helper to check if a container should be shown
  const shouldShowContainer = (nodeId: string) => {
    // Show container if node has maxPoints > 1 and is available or unlocked
    const node = effectiveNodes.find((n) => n.id === nodeId);
    if (!node) return false;

    // Check tree visibility (includes portrait mode logic)
    if (!isTreeVisible(node.tree)) return false;

    // Only show containers for nodes that require multiple points
    if ((node.maxPoints ?? 1) <= 1) return false;

    // Hide container if max points reached
    const currentPoints = getSkillPoints(nodeId);
    if (currentPoints >= (node.maxPoints ?? 1)) return false;

    const totalTreePoints = getTotalTreePoints(node.tree);
    const nodeState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

    // Show container when node is available (can allocate) or unlocked (has points)
    return nodeState === 'available' || nodeState === 'unlocked';
  };

  // Helper to get node color based on tree (always returns tree color)
  const getNodeColor = (nodeId: string) => {
    const node = effectiveNodes.find((n) => n.id === nodeId);
    if (!node) return '#6c7074';

    // Always return the tree color
    const treeColorMap = {
      A: treeSettings?.A?.color ?? '#93FFF9',
      B: treeSettings?.B?.color ?? '#00D86D',
      C: treeSettings?.C?.color ?? '#FFD400',
      D: treeSettings?.D?.color ?? '#FF0000',
    };

    return treeColorMap[node.tree];
  };

  // Helper to check if a lock icon should be shown
  const shouldShowLock = (nodeId: string) => {
    // Debug mode: show all locks if containers are shown
    if (showAllContainers) return true;

    const node = effectiveNodes.find((n) => n.id === nodeId);
    if (!node) return false;

    // Check tree visibility (includes portrait mode logic)
    if (!isTreeVisible(node.tree)) return false;

    // Only show locks on key nodes (larger notable nodes)
    if (!node.isKeyNode) return false;

    const totalTreePoints = getTotalTreePoints(node.tree);
    const nodeState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

    // Show lock only when node is locked (not available or unlocked)
    return nodeState === 'locked';
  };

  // Helper to get lock icon color based on hover state
  const getLockColor = (nodeId: string) => {
    return state.hoveredSkill === nodeId ? '#f5f0dc' : '#6c7074';
  };

  // Helper to get counter-rotation angle for portrait mode
  // This makes elements appear vertical when the tree is rotated
  const getPortraitCounterRotation = (tree: TreeType): number => {
    if (!isMobilePortrait || !portraitActiveTree) return 0;
    const rotations: Record<TreeType, number> = {
      A: -86.174394,
      B: -59.784596,
      C: 0,
      D: 59.554601
    };
    return rotations[tree] || 0;
  };

  // Helper to get lock transform with portrait mode rotation
  // Lock base coordinates: cx="221.57201", cy="247.53424"
  // Now takes node center coordinates to rotate around node center (maintaining orbital position)
  const getLockTransform = (tree: TreeType, translateX: number, translateY: number, nodeCenterX: number, nodeCenterY: number): string => {
    const rotation = getPortraitCounterRotation(tree);
    if (rotation === 0) {
      // No rotation needed, just translate (or no transform if translate is 0,0)
      if (translateX === 0 && translateY === 0) return '';
      return `translate(${translateX},${translateY})`;
    }
    // In portrait mode: translate then rotate around the node center
    // Since translate is applied first, the rotation center must be adjusted to account for the translation
    // The node center in the translated coordinate space is (nodeCenterX - translateX, nodeCenterY - translateY)
    const adjustedCenterX = nodeCenterX - translateX;
    const adjustedCenterY = nodeCenterY - translateY;
    if (translateX === 0 && translateY === 0) {
      return `rotate(${rotation}, ${nodeCenterX}, ${nodeCenterY})`;
    }
    return `translate(${translateX},${translateY}) rotate(${rotation}, ${adjustedCenterX}, ${adjustedCenterY})`;
  };

  // Helper to get container transform with portrait mode rotation
  const getContainerTransform = (tree: TreeType, centerX: number, centerY: number): string => {
    const rotation = getPortraitCounterRotation(tree);
    if (rotation === 0) return '';
    return `rotate(${rotation}, ${centerX}, ${centerY})`;
  };

  // Helper to get node's transformed position in the container/lock coordinate space
  const getNodeTransformedPosition = (nodeId: string, tree: TreeType): { x: number; y: number } => {
    const node = filteredNodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    switch (tree) {
      case 'A': {
        // Tree A uses matrix transform: matrix(0.82544171,0.56448736,0.56221371,-0.82211698,81.266847,463.85256)
        const a = 0.82544171, b = 0.56448736, c = 0.56221371, d = -0.82211698, e = 81.266847, f = 463.85256;
        return { x: a * node.x + c * node.y + e, y: b * node.x + d * node.y + f };
      }
      case 'B':
      case 'C':
        // Trees B and C use translation: translate(221.93716, 39.335736)
        return { x: node.x + 221.93716, y: node.y + 39.335736 };
      case 'D':
        // Tree D uses horizontal flip: matrix(-1,0,0,1,552.10903,48.512262)
        return { x: -1 * node.x + 552.10903, y: node.y + 48.512262 };
      default:
        return { x: node.x, y: node.y };
    }
  };

  return (
    <div
      className="relative"
      style={{
        backgroundColor: '#050709',
        overflow: 'hidden',
        // Use fixed positioning to fill entire viewport in fullscreen
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Use viewport units to ensure proper sizing in fullscreen mode
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Bottom Right Toolbar - hidden in mobile landscape and during loading */}
      {!isMobileLandscape && minLoadingTimePassed && isViewInitialized && (
        <BottomToolbar
          onShare={() => {
            // Copy current URL to clipboard
            navigator.clipboard.writeText(window.location.href);
          }}
          onReset={resetAll}
          onEditModeToggle={() => setIsEditMode(!isEditMode)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isEditMode={isEditMode}
          totalPoints={(['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)}
          maxPoints={100}
          mode={mode}
          isWindowActive={isWindowActive}
          particlesPaused={particlesPaused}
          onToggleParticles={() => setParticlesPaused(!particlesPaused)}
        />
      )}

      {/* Version label - fixed position for desktop and landscape */}
      {!isMobilePortrait && minLoadingTimePassed && isViewInitialized && (
        <div
          className={`fixed bottom-2 left-4 z-50 text-white/30 ${isMobileLandscape ? 'text-[6px]' : 'text-xs'}`}
          style={{ fontFamily: 'var(--font-montserrat)' }}
        >
          {VERSION_LABEL}
        </div>
      )}

      {/* Version label - rotated along left edge for mobile portrait */}
      {isMobilePortrait && minLoadingTimePassed && isViewInitialized && (
        <div
          className="fixed left-2 z-40 text-white/30 text-[10px] whitespace-nowrap pointer-events-none"
          style={{
            fontFamily: 'var(--font-montserrat)',
            top: '50%',
            transform: 'rotate(-90deg) translateX(-50%)',
            transformOrigin: 'left center',
          }}
        >
          {VERSION_LABEL}
        </div>
      )}

      {/* Mobile Landscape Toolbar Tab - collapsed by default at bottom right, attached to bottom */}
      {isMobileLandscape && minLoadingTimePassed && isViewInitialized && (
        <div className="fixed right-4 bottom-0 z-50">
          <AnimatePresence>
            {mobileToolbarOpen ? (
              // Expanded panel with buttons - horizontal row
              <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                exit={{ y: 50 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-row items-center gap-2 px-2 py-1.5 rounded-t-lg"
                style={{ backgroundColor: '#2d2d2d' }}
              >
                {/* 1. Info / Question Mark Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileResetConfirm(false);
                    setShowMobileHelpToast(true);
                    setTimeout(() => setShowMobileHelpToast(false), 4000);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Help"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512">
                    <path fillRule="evenodd" d="M256,512C114.625,512,0,397.391,0,256,0,114.625,114.625,0,256,0S512,114.625,512,256C512,397.391,397.375,512,256,512Zm0-448C149.969,64,64,149.969,64,256s85.969,192,192,192,192-85.969,192-192S362.031,64,256,64Z"/>
                    <path fillRule="evenodd" d="M256,128a96,96,0,0,0-96,96h64a32,32,0,1,1,32,32H240a16,16,0,0,0-16,16v48h64v-5.875c37.188-13.219,64-48.391,64-90.125A96,96,0,0,0,256,128Z"/>
                    <path fillRule="evenodd" d="M256,352H224v32h64V352Z"/>
                  </svg>
                </button>

                {/* 2. Reset All Points Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(true);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Reset All Points"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4V1L7 5l5 5V7c2.76 0 5 2.24 5 5 0 .85-.22 1.65-.6 2.35l1.5 1.5C19.6 14.65 20 13.38 20 12c0-4.42-3.58-8-8-8zm0 14c-2.76 0-5-2.24-5-5 0-.85.22-1.65.6-2.35l-1.5-1.5C4.4 10.35 4 11.62 4 13c0 4.42 3.58 8 8 8v3l5-5-5-5v4z"/>
                  </svg>
                </button>

                {/* 3. Share Button */}
                <button
                  onClick={() => {
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    navigator.clipboard.writeText(window.location.href);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Share"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                  </svg>
                </button>

                {/* 4. Prototype/Return Button with bubble animation */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    if (isProtoMode) {
                      router.push('/');
                    } else {
                      router.push('/proto');
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title={isProtoMode ? "Return to Main Tree" : "View Prototype Tree"}
                >
                  {isProtoMode ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 11H6.83l3.88-3.88a1.5 1.5 0 10-2.12-2.12l-6.59 6.59a1.5 1.5 0 000 2.12l6.59 6.59a1.5 1.5 0 102.12-2.12L6.83 14H20c.83 0 1.5-.67 1.5-1.5S20.83 11 20 11z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
                      <defs>
                        <style>
                          {`
                            @keyframes mobile-bubble-up-1 {
                              0% { opacity: 0; transform: translateY(0); }
                              15% { opacity: 1; }
                              85% { opacity: 1; }
                              100% { opacity: 0; transform: translateY(-8px); }
                            }
                            @keyframes mobile-bubble-up-2 {
                              0% { opacity: 0; transform: translateY(0); }
                              15% { opacity: 1; }
                              85% { opacity: 1; }
                              100% { opacity: 0; transform: translateY(-10px); }
                            }
                            @keyframes mobile-bubble-up-3 {
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
                        style={{ animation: 'mobile-bubble-up-1 2s ease-out infinite', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                      <circle
                        cx="12" cy="4.5" r="0.8" fill="currentColor"
                        style={{ animation: 'mobile-bubble-up-2 2.4s ease-out infinite 0.6s', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                      <circle
                        cx="13.5" cy="4" r="0.6" fill="currentColor"
                        style={{ animation: 'mobile-bubble-up-3 2.2s ease-out infinite 1.2s', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                    </svg>
                  )}
                </button>

                {/* 5. Fullscreen / Immersive Mode Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    toggleFullscreen();
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                      <g>
                        <polygon points="461.212,314.349 314.342,314.349 314.342,461.205 357.596,417.973 451.591,511.985 512,451.599 417.973,357.581" />
                        <polygon points="50.788,197.667 197.659,197.667 197.659,50.797 154.42,94.043 60.394,0.025 0,60.417 94.027,154.428" />
                        <polygon points="94.035,357.588 0.016,451.599 60.394,511.992 154.42,417.973 197.668,461.205 197.668,314.349 50.788,314.349" />
                        <polygon points="417.99,154.428 512,60.401 451.591,0.008 357.58,94.035 314.342,50.797 314.342,197.651 461.212,197.651" />
                      </g>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                      <g>
                        <polygon points="345.495,0 394.507,49.023 287.923,155.607 356.384,224.086 462.987,117.493 511.991,166.515 511.991,0" />
                        <polygon points="155.615,287.914 49.022,394.507 0.009,345.494 0.009,512 166.515,512 117.493,462.978 224.087,356.375" />
                        <polygon points="356.384,287.914 287.923,356.375 394.507,462.978 345.495,512 511.991,512 511.991,345.485 462.977,394.507" />
                        <polygon points="166.505,0 0.009,0 0.009,166.506 49.022,117.493 155.615,224.086 224.087,155.607 117.501,49.023" />
                      </g>
                    </svg>
                  )}
                </button>

                {/* 6. Collapse Tab Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    setMobileToolbarOpen(false);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </motion.div>
            ) : (
              // Collapsed tab handle - horizontal at bottom
              <motion.button
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ y: 20 }}
                onClick={() => setMobileToolbarOpen(true)}
                className="flex items-center justify-center w-12 h-6 rounded-t-lg"
                style={{ backgroundColor: '#2d2d2d' }}
              >
                <svg className="w-3 h-3 text-[#a89f91]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mobile Share Toast */}
          <AnimatePresence>
            {copySuccess && (
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="fixed right-4 bottom-14 px-3 py-2 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc' }}
              >
                <p className="text-[10px] font-bold text-[#1a2744] whitespace-nowrap">URL Copied!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Prototype Warning Toast */}
          <AnimatePresence>
            {showMobileProtoWarning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed right-4 bottom-14 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '220px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-1 whitespace-nowrap">Don&apos;t shoot!</p>
                <p className="text-[9px] text-[#78716c] leading-tight">This is a fan-made tree, not official or datamined.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Help Toast */}
          <AnimatePresence>
            {showMobileHelpToast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed right-4 bottom-14 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '220px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-2 whitespace-nowrap">Landscape Mode</p>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 shrink-0 text-[#78716c]" fill="currentColor" viewBox="0 0 512 512">
                    <g>
                      <polygon points="345.495,0 394.507,49.023 287.923,155.607 356.384,224.086 462.987,117.493 511.991,166.515 511.991,0" />
                      <polygon points="155.615,287.914 49.022,394.507 0.009,345.494 0.009,512 166.515,512 117.493,462.978 224.087,356.375" />
                      <polygon points="356.384,287.914 287.923,356.375 394.507,462.978 345.495,512 511.991,512 511.991,345.485 462.977,394.507" />
                      <polygon points="166.505,0 0.009,0 0.009,166.506 49.022,117.493 155.615,224.086 224.087,155.607 117.501,49.023" />
                    </g>
                  </svg>
                  <p className="text-[9px] text-[#78716c] leading-tight">Use immersive mode for a better experience</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0 text-[#78716c]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"/>
                  </svg>
                  <p className="text-[9px] text-[#78716c] leading-tight">Rotate your phone to switch between global and focused mode</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Reset Confirmation Toast */}
          <AnimatePresence>
            {showMobileResetConfirm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed right-4 bottom-14 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '200px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-2 whitespace-nowrap">Reset All Points?</p>
                <p className="text-[9px] text-[#78716c] leading-tight mb-3">This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetAll();
                      setShowMobileResetConfirm(false);
                    }}
                    className="flex-1 px-3 py-1.5 rounded text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: '#c53030' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowMobileResetConfirm(false)}
                    className="flex-1 px-3 py-1.5 rounded text-[10px] font-bold uppercase text-[#1a2744]"
                    style={{ backgroundColor: '#d4d0c4' }}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Mobile Portrait Toolbar Tab - collapsed by default at top center, attached to top */}
      {isMobilePortrait && minLoadingTimePassed && isViewInitialized && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50">
          <AnimatePresence>
            {mobileToolbarOpen ? (
              // Expanded panel with buttons - horizontal row
              <motion.div
                initial={{ y: -50 }}
                animate={{ y: 0 }}
                exit={{ y: -50 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-row items-center gap-2 px-2 py-1.5 rounded-b-lg"
                style={{ backgroundColor: '#2d2d2d' }}
              >
                {/* 1. Info / Question Mark Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileResetConfirm(false);
                    setShowMobileHelpToast(true);
                    setTimeout(() => setShowMobileHelpToast(false), 4000);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Help"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512">
                    <path fillRule="evenodd" d="M256,512C114.625,512,0,397.391,0,256,0,114.625,114.625,0,256,0S512,114.625,512,256C512,397.391,397.375,512,256,512Zm0-448C149.969,64,64,149.969,64,256s85.969,192,192,192,192-85.969,192-192S362.031,64,256,64Z"/>
                    <path fillRule="evenodd" d="M256,128a96,96,0,0,0-96,96h64a32,32,0,1,1,32,32H240a16,16,0,0,0-16,16v48h64v-5.875c37.188-13.219,64-48.391,64-90.125A96,96,0,0,0,256,128Z"/>
                    <path fillRule="evenodd" d="M256,352H224v32h64V352Z"/>
                  </svg>
                </button>

                {/* 2. Reset All Points Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(true);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Reset All Points"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4V1L7 5l5 5V7c2.76 0 5 2.24 5 5 0 .85-.22 1.65-.6 2.35l1.5 1.5C19.6 14.65 20 13.38 20 12c0-4.42-3.58-8-8-8zm0 14c-2.76 0-5-2.24-5-5 0-.85.22-1.65.6-2.35l-1.5-1.5C4.4 10.35 4 11.62 4 13c0 4.42 3.58 8 8 8v3l5-5-5-5v4z"/>
                  </svg>
                </button>

                {/* 3. Share Button */}
                <button
                  onClick={() => {
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    navigator.clipboard.writeText(window.location.href);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title="Share"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                  </svg>
                </button>

                {/* 4. Prototype/Return Button with bubble animation */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    if (isProtoMode) {
                      router.push('/');
                    } else {
                      router.push('/proto');
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title={isProtoMode ? "Return to Main Tree" : "View Prototype Tree"}
                >
                  {isProtoMode ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 11H6.83l3.88-3.88a1.5 1.5 0 10-2.12-2.12l-6.59 6.59a1.5 1.5 0 000 2.12l6.59 6.59a1.5 1.5 0 102.12-2.12L6.83 14H20c.83 0 1.5-.67 1.5-1.5S20.83 11 20 11z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
                      <defs>
                        <style>
                          {`
                            @keyframes portrait-bubble-up-1 {
                              0% { opacity: 0; transform: translateY(0); }
                              15% { opacity: 1; }
                              85% { opacity: 1; }
                              100% { opacity: 0; transform: translateY(-8px); }
                            }
                            @keyframes portrait-bubble-up-2 {
                              0% { opacity: 0; transform: translateY(0); }
                              15% { opacity: 1; }
                              85% { opacity: 1; }
                              100% { opacity: 0; transform: translateY(-10px); }
                            }
                            @keyframes portrait-bubble-up-3 {
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
                        style={{ animation: 'portrait-bubble-up-1 2s ease-out infinite', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                      <circle
                        cx="12" cy="4.5" r="0.8" fill="currentColor"
                        style={{ animation: 'portrait-bubble-up-2 2.4s ease-out infinite 0.6s', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                      <circle
                        cx="13.5" cy="4" r="0.6" fill="currentColor"
                        style={{ animation: 'portrait-bubble-up-3 2.2s ease-out infinite 1.2s', animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused' }}
                      />
                    </svg>
                  )}
                </button>

                {/* 5. Fullscreen / Immersive Mode Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    toggleFullscreen();
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                      <g>
                        <polygon points="461.212,314.349 314.342,314.349 314.342,461.205 357.596,417.973 451.591,511.985 512,451.599 417.973,357.581" />
                        <polygon points="50.788,197.667 197.659,197.667 197.659,50.797 154.42,94.043 60.394,0.025 0,60.417 94.027,154.428" />
                        <polygon points="94.035,357.588 0.016,451.599 60.394,511.992 154.42,417.973 197.668,461.205 197.668,314.349 50.788,314.349" />
                        <polygon points="417.99,154.428 512,60.401 451.591,0.008 357.58,94.035 314.342,50.797 314.342,197.651 461.212,197.651" />
                      </g>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                      <g>
                        <polygon points="345.495,0 394.507,49.023 287.923,155.607 356.384,224.086 462.987,117.493 511.991,166.515 511.991,0" />
                        <polygon points="155.615,287.914 49.022,394.507 0.009,345.494 0.009,512 166.515,512 117.493,462.978 224.087,356.375" />
                        <polygon points="356.384,287.914 287.923,356.375 394.507,462.978 345.495,512 511.991,512 511.991,345.485 462.977,394.507" />
                        <polygon points="166.505,0 0.009,0 0.009,166.506 49.022,117.493 155.615,224.086 224.087,155.607 117.501,49.023" />
                      </g>
                    </svg>
                  )}
                </button>

                {/* 6. Collapse Tab Button */}
                <button
                  onClick={() => {
                    setCopySuccess(false);
                    setShowMobileHelpToast(false);
                    setShowMobileResetConfirm(false);
                    setMobileToolbarOpen(false);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#a89f91] active:scale-95 active:bg-[#4d4d4d] active:text-white transition-all duration-100 focus:outline-none"
                  style={{ backgroundColor: '#3d3d3d', WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </motion.div>
            ) : (
              // Collapsed tab handle - horizontal at top center
              <motion.button
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                exit={{ y: -20 }}
                onClick={() => setMobileToolbarOpen(true)}
                className="flex items-center justify-center w-12 h-6 rounded-b-lg"
                style={{ backgroundColor: '#2d2d2d' }}
              >
                <svg className="w-3 h-3 text-[#a89f91]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Portrait Share Toast */}
          <AnimatePresence>
            {copySuccess && (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc' }}
              >
                <p className="text-[10px] font-bold text-[#1a2744] whitespace-nowrap">URL Copied!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Portrait Prototype Warning Toast */}
          <AnimatePresence>
            {showMobileProtoWarning && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '220px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-1 whitespace-nowrap">Don&apos;t shoot!</p>
                <p className="text-[9px] text-[#78716c] leading-tight">This is a fan-made tree, not official or datamined.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Portrait Help Toast */}
          <AnimatePresence>
            {showMobileHelpToast && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '220px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-2 whitespace-nowrap">Portrait Mode</p>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 shrink-0 text-[#78716c]" fill="currentColor" viewBox="0 0 512 512">
                    <g>
                      <polygon points="345.495,0 394.507,49.023 287.923,155.607 356.384,224.086 462.987,117.493 511.991,166.515 511.991,0" />
                      <polygon points="155.615,287.914 49.022,394.507 0.009,345.494 0.009,512 166.515,512 117.493,462.978 224.087,356.375" />
                      <polygon points="356.384,287.914 287.923,356.375 394.507,462.978 345.495,512 511.991,512 511.991,345.485 462.977,394.507" />
                      <polygon points="166.505,0 0.009,0 0.009,166.506 49.022,117.493 155.615,224.086 224.087,155.607 117.501,49.023" />
                    </g>
                  </svg>
                  <p className="text-[9px] text-[#78716c] leading-tight">Use immersive mode for a better experience</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0 text-[#78716c]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"/>
                  </svg>
                  <p className="text-[9px] text-[#78716c] leading-tight">Rotate your phone to switch between global and focused mode</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Portrait Reset Confirmation Toast */}
          <AnimatePresence>
            {showMobileResetConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-3 rounded-lg shadow-lg"
                style={{ backgroundColor: '#f5f0dc', minWidth: '200px' }}
              >
                <p className="text-[11px] font-bold text-[#1a2744] uppercase mb-2 whitespace-nowrap">Reset All Points?</p>
                <p className="text-[9px] text-[#78716c] leading-tight mb-3">This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetAll();
                      setShowMobileResetConfirm(false);
                    }}
                    className="flex-1 px-3 py-1.5 rounded text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: '#c53030' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowMobileResetConfirm(false)}
                    className="flex-1 px-3 py-1.5 rounded text-[10px] font-bold uppercase text-[#1a2744]"
                    style={{ backgroundColor: '#d4d0c4' }}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tree Settings Panel */}
      {treeSettings && (
        <TreeSettings
          isEditMode={isEditMode}
          initialSettings={treeSettings}
          onSave={handleSaveTreeSettings}
          externalOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          isProtoMode={isProtoMode}
        />
      )}

      {/* Node Editor Modal */}
      <AnimatePresence>
        {editingNode && (
          <NodeEditor
            node={editingNode}
            onClose={() => setEditingNode(null)}
            onSave={handleSaveNode}
          />
        )}
      </AnimatePresence>

      {/* Proto Tree Warning Modal */}
      <ConfirmationModal
        isOpen={showProtoWarning}
        title="DON'T SHOOT!"
        description="This is not an official or datamined tree. It is a fan-made creation based on speculation and community ideas."
        confirmText="OKAY, I UNDERSTAND"
        onConfirm={() => setShowProtoWarning(false)}
        onCancel={() => setShowProtoWarning(false)}
        singleButton={true}
      />

      {/* Parallax Background Blobs - viewport centered, size scales with initial zoom for consistency */}
      {initialView && (
        <div
          className="fixed pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            // Viewport-centered with parallax, scale based on initial zoom for consistent sizing
            transform: `translate(calc(-50% + ${pan.x * 0.3}px), calc(-50% + ${pan.y * 0.3}px)) scale(${1 + (zoom - 1) * 0.15})`,
            transformOrigin: 'center center',
            transition: isPanning
              ? 'none'
              : isTreeTransitioning
                ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'transform 0.1s ease-out',
            zIndex: 0,
          }}
        >
          {/* Right side subtle blue glow */}
          <div
            className="absolute"
            style={{
              // Size scales with initialZoom so blobs maintain consistent visual proportion
              width: `${BLOB_CONFIG.rightBlob.size * baseScale * initialView.zoom}px`,
              height: `${BLOB_CONFIG.rightBlob.size * baseScale * initialView.zoom}px`,
              borderRadius: '50%',
              background: BLOB_CONFIG.rightBlob.gradient,
              filter: `blur(${BLOB_CONFIG.rightBlob.blur}px)`,
              opacity: BLOB_CONFIG.rightBlob.opacity,
              // Position scales with initialZoom for consistent placement
              left: `${BLOB_CONFIG.rightBlob.offsetX * baseScale * initialView.zoom}px`,
              top: `${BLOB_CONFIG.rightBlob.offsetY * baseScale * initialView.zoom}px`,
              willChange: 'auto',
            }}
          />
          {/* Large ambient glow - left blob */}
          <div
            className="absolute"
            style={{
              width: `${BLOB_CONFIG.leftBlob.size * baseScale * initialView.zoom}px`,
              height: `${BLOB_CONFIG.leftBlob.size * baseScale * initialView.zoom}px`,
              borderRadius: '50%',
              background: BLOB_CONFIG.leftBlob.gradient,
              filter: `blur(${BLOB_CONFIG.leftBlob.blur}px)`,
              opacity: BLOB_CONFIG.leftBlob.opacity,
              left: `${BLOB_CONFIG.leftBlob.offsetX * baseScale * initialView.zoom}px`,
              top: `${BLOB_CONFIG.leftBlob.offsetY * baseScale * initialView.zoom}px`,
              willChange: 'auto',
            }}
          />
        </div>
      )}

      {/* SVG Container */}
      <div
        ref={viewportRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isPanning ? 'grabbing' : 'default',
          overscrollBehavior: 'none',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        {/* Loading screen overlay */}
        {(!treeSettings || !minLoadingTimePassed || !isViewInitialized) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full gap-6 bg-[#090C19] z-50">
            <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-montserrat)' }}>
              Loading...
            </span>
            <div
              style={{
                animation: 'spin 2s linear infinite',
                willChange: 'transform'
              }}
            >
              <style>
                {`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}
              </style>
              <svg
                width="80"
                height="80"
                viewBox="0 0 25.875698 25.875698"
              >
                <circle
                  style={{ fill: 'none', stroke: '#edf6ff', strokeWidth: 0.9, strokeLinecap: 'round' }}
                  cx="12.937849"
                  cy="12.937849"
                  r="12.487849"
                />
                <circle
                  style={{ fill: 'none', stroke: '#edf6ff', strokeWidth: 0.9, strokeLinecap: 'round' }}
                  cx="12.893109"
                  cy="12.848319"
                  r="2.7750776"
                />
                <path
                  style={{ fill: 'none', stroke: '#edf6ff', strokeWidth: 0.9, strokeLinecap: 'round' }}
                  d="m 2.597900,14.922570 4.74743,-0.64881 c 0,0 0.34566,0.69217 0.51678,1.04755 0.17111,0.35539 0.51185,1.07297 0.51185,1.07297 l -3.44982,3.40233 c 0,0 -1.67743,-1.5983 -2.32624,-4.87404 z"
                />
                <path
                  style={{ fill: 'none', stroke: '#edf6ff', strokeWidth: 0.9, strokeLinecap: 'round' }}
                  d="m 2.597900,14.922570 4.74743,-0.64881 c 0,0 0.34566,0.69217 0.51678,1.04755 0.17111,0.35539 0.51185,1.07297 0.51185,1.07297 l -3.44982,3.40233 c 0,0 -1.67743,-1.5983 -2.32624,-4.87404 z"
                  transform="rotate(-120.33949,12.81150,12.90154)"
                />
                <path
                  style={{ fill: 'none', stroke: '#edf6ff', strokeWidth: 0.9, strokeLinecap: 'round' }}
                  d="m 2.597900,14.922570 4.74743,-0.64881 c 0,0 0.34566,0.69217 0.51678,1.04755 0.17111,0.35539 0.51185,1.07297 0.51185,1.07297 l -3.44982,3.40233 c 0,0 -1.67743,-1.5983 -2.32624,-4.87404 z"
                  transform="rotate(118.12418,12.97006,13.00232)"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Tree container - always rendered but initially hidden */}
        <div
          ref={containerRef}
          className="absolute top-0 left-0"
          style={{
            visibility: (isViewInitialized && minLoadingTimePassed) ? 'visible' : 'hidden',
            width: '100%',
            transform: (() => {
              // In portrait mode, counter-rotate based on active tree to make it upright
              if (isMobilePortrait && portraitActiveTree) {
                const rotations = {
                  A: 86.174394,  // Counter-rotate (opposite sign)
                  B: 59.784596,
                  C: 0,
                  D: -59.554601
                };
                const rotation = rotations[portraitActiveTree];
                // Use transform with rotation around center (handled via transformOrigin)
                return `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`;
              }
              return `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
            })(),
            transformOrigin: '0 0',
            transition: (isPanning || !isViewInitialized)
              ? 'none'
              : isTreeTransitioning
                ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'transform 0.1s ease-out',
          }}
        >
          {/* Interactive Overlay - Paths and Nodes */}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute top-0 left-0 w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none', zIndex: 999 }}
          >
            {/* Filter for path blur effect */}
            <defs>
              <filter id="pathBlur">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.15" />
              </filter>
            </defs>

            {/* Tree B Paths */}
            {isTreeVisible('B') && (
            <g transform="translate(221.93716,39.335736)">
              {/* Grey (inactive) paths - rendered first */}
              {filteredPaths
                .filter((p) => p.tree === 'B' && !shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: '#6c7074',
                        strokeWidth: 0.9,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Colored (active) paths - rendered on top */}
              {filteredPaths
                .filter((p) => p.tree === 'B' && shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: treeSettings?.B?.color ?? '#00D86D',
                        strokeWidth: 3.8,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Bottom connector path for Tree B */}
              <motion.path
                key={`bottom-path-b-${treeSettingsVersion}`}
                id={`${BOTTOM_CONNECTOR_PATHS.B}-b`}
                d={pathData[BOTTOM_CONNECTOR_PATHS.B] || ''}
                className="pointer-events-none"
                initial={{ pathLength: 1, opacity: 1 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                style={{
                  fill: 'none',
                  stroke: shouldColorBottomPath('B') ? treeSettings?.B?.color ?? "#00D86D" : '#6c7074',
                  strokeWidth: shouldColorBottomPath('B') ? 3.8 : 0.9,
                }}
              />
            </g>
            )}

            {/* Tree A Paths */}
            {isTreeVisible('A') && (
            <g transform="matrix(0.82544171,0.56448736,0.56221371,-0.82211698,81.266847,463.85256)">
              {/* Grey (inactive) paths - rendered first */}
              {filteredPaths
                .filter((p) => p.tree === 'A' && !shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: '#6c7074',
                        strokeWidth: 0.9,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Colored (active) paths - rendered on top */}
              {filteredPaths
                .filter((p) => p.tree === 'A' && shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: treeSettings?.A?.color ?? '#93FFF9',
                        strokeWidth: 3.8,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Bottom connector path for Tree A */}
              <motion.path
                key={`bottom-path-a-${treeSettingsVersion}`}
                id={`${BOTTOM_CONNECTOR_PATHS.A}-a`}
                d={pathData[BOTTOM_CONNECTOR_PATHS.A] || ''}
                className="pointer-events-none"
                initial={{ pathLength: 1, opacity: 1 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                style={{
                  fill: 'none',
                  stroke: shouldColorBottomPath('A') ? treeSettings?.A?.color ?? "#93FFF9" : '#6c7074',
                  strokeWidth: shouldColorBottomPath('A') ? 3.8 : 0.9,
                }}
              />
            </g>
            )}

            {/* Tree B Nodes */}
            {isTreeVisible('B') && (
            <g transform="translate(221.93716,39.335736)">
              {filteredNodes
                .filter((n) => n.tree === 'B')
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);
                  const canRemove = canRemovePoint(node.id, state.skillPoints, effectiveNodes);

                  return (
                    <SkillNodeComponent
                      key={node.id}
                      node={node}
                      skillState={skillState}
                      currentPoints={currentPoints}
                      isHovered={state.hoveredSkill === node.id || (isMobilePortrait && selectedPortraitSkillId === node.id) || (isMobileLandscape && tooltipData?.skillId === node.id)}
                      canRemove={canRemove}
                      treeColor={treeSettings?.B?.color ?? '#00D86D'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      isMobilePortrait={isMobilePortrait}
                      portraitActiveTree={portraitActiveTree}
                      onHover={(hover, e) => {
                        if (hover && e) {
                          const rect = (e.target as SVGElement).getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const centerY = rect.top + rect.height / 2;
                          // Calculate actual screen radius from the bounding rect (width/2 gives us the radius in screen pixels)
                          const screenRadius = rect.width / 2;
                          handleNodeHover(node.id, centerX, centerY, screenRadius);
                        } else {
                          handleNodeHover(null);
                        }
                      }}
                    />
                  );
                })}
            </g>
            )}

            {/* Tree A Nodes */}
            {isTreeVisible('A') && (
            <g transform="matrix(0.82544171,0.56448736,0.56221371,-0.82211698,81.266847,463.85256)">
              {filteredNodes
                .filter((n) => n.tree === 'A')
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);
                  const canRemove = canRemovePoint(node.id, state.skillPoints, effectiveNodes);

                  return (
                    <SkillNodeComponent
                      key={node.id}
                      node={node}
                      skillState={skillState}
                      currentPoints={currentPoints}
                      isHovered={state.hoveredSkill === node.id || (isMobilePortrait && selectedPortraitSkillId === node.id) || (isMobileLandscape && tooltipData?.skillId === node.id)}
                      canRemove={canRemove}
                      treeColor={treeSettings?.A?.color ?? '#93FFF9'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      isMobilePortrait={isMobilePortrait}
                      portraitActiveTree={portraitActiveTree}
                      onHover={(hover, e) => {
                        if (hover && e) {
                          const rect = (e.target as SVGElement).getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const centerY = rect.top + rect.height / 2;
                          // Calculate actual screen radius from the bounding rect (width/2 gives us the radius in screen pixels)
                          const screenRadius = rect.width / 2;
                          handleNodeHover(node.id, centerX, centerY, screenRadius);
                        } else {
                          handleNodeHover(null);
                        }
                      }}
                    />
                  );
                })}
            </g>
            )}

            {/* Tree C Paths */}
            {isTreeVisible('C') && (
            <g transform="translate(221.93716,39.335736)">
              {/* Grey (inactive) paths - rendered first */}
              {filteredPaths
                .filter((p) => p.tree === 'C' && !shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: '#6c7074',
                        strokeWidth: 0.9,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Colored (active) paths - rendered on top */}
              {filteredPaths
                .filter((p) => p.tree === 'C' && shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: treeSettings?.C?.color ?? '#FFD400',
                        strokeWidth: 3.8,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Bottom connector path for Tree C */}
              <motion.path
                key={`bottom-path-c-${treeSettingsVersion}`}
                id={`${BOTTOM_CONNECTOR_PATHS.C}-c`}
                d={pathData[BOTTOM_CONNECTOR_PATHS.C] || ''}
                className="pointer-events-none"
                initial={{ pathLength: 1, opacity: 1 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                style={{
                  fill: 'none',
                  stroke: shouldColorBottomPath('C') ? treeSettings?.C?.color ?? "#FFD400" : '#6c7074',
                  strokeWidth: shouldColorBottomPath('C') ? 3.8 : 0.9,
                }}
              />
            </g>
            )}

            {/* Tree C Nodes */}
            {isTreeVisible('C') && (
            <g transform="translate(221.93716,39.335736)">
              {filteredNodes
                .filter((n) => n.tree === 'C')
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);
                  const canRemove = canRemovePoint(node.id, state.skillPoints, effectiveNodes);

                  return (
                    <SkillNodeComponent
                      key={node.id}
                      node={node}
                      skillState={skillState}
                      currentPoints={currentPoints}
                      isHovered={state.hoveredSkill === node.id || (isMobilePortrait && selectedPortraitSkillId === node.id) || (isMobileLandscape && tooltipData?.skillId === node.id)}
                      canRemove={canRemove}
                      treeColor={treeSettings?.C?.color ?? '#FFD400'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      isMobilePortrait={isMobilePortrait}
                      portraitActiveTree={portraitActiveTree}
                      onHover={(hover, e) => {
                        if (hover && e) {
                          const rect = (e.target as SVGElement).getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const centerY = rect.top + rect.height / 2;
                          // Calculate actual screen radius from the bounding rect (width/2 gives us the radius in screen pixels)
                          const screenRadius = rect.width / 2;
                          handleNodeHover(node.id, centerX, centerY, screenRadius);
                        } else {
                          handleNodeHover(null);
                        }
                      }}
                    />
                  );
                })}
            </g>
            )}

            {/* Tree D Paths */}
            {isTreeVisible('D') && (
            <g transform="matrix(-1,0,0,1,552.10903,48.512262)">
              {/* Grey (inactive) paths - rendered first */}
              {filteredPaths
                .filter((p) => p.tree === 'D' && !shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: '#6c7074',
                        strokeWidth: 0.9,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Colored (active) paths - rendered on top */}
              {filteredPaths
                .filter((p) => p.tree === 'D' && shouldColorPath(p.id))
                .map((path) => {
                  const dAttr = pathData[path.svgId] || '';

                  return (
                    <motion.path
                      key={path.id}
                      id={path.svgId}
                      d={dAttr}
                      className={`pointer-events-none`}
                      initial={false}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        stroke: treeSettings?.D?.color ?? '#FF0000',
                        strokeWidth: 3.8,
                      }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fill: 'none',
                      strokeLinecap: 'round',
                      }}
                    />
                  );
                })}
              {/* Bottom connector path for Tree D */}
              <motion.path
                key={`bottom-path-d-${treeSettingsVersion}`}
                id={`${BOTTOM_CONNECTOR_PATHS.D}-d`}
                d={pathData[BOTTOM_CONNECTOR_PATHS.D] || ''}
                className="pointer-events-none"
                initial={{ pathLength: 1, opacity: 1 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                style={{
                  fill: 'none',
                  stroke: shouldColorBottomPath('D') ? treeSettings?.D?.color ?? "#FF0000" : '#6c7074',
                  strokeWidth: shouldColorBottomPath('D') ? 3.8 : 0.9,
                }}
              />
            </g>
            )}

            {/* Tree D Nodes */}
            {isTreeVisible('D') && (
            <g transform="matrix(-1,0,0,1,552.10903,48.512262)">
              {filteredNodes
                .filter((n) => n.tree === 'D')
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);
                  const canRemove = canRemovePoint(node.id, state.skillPoints, effectiveNodes);

                  return (
                    <SkillNodeComponent
                      key={node.id}
                      node={node}
                      skillState={skillState}
                      currentPoints={currentPoints}
                      isHovered={state.hoveredSkill === node.id || (isMobilePortrait && selectedPortraitSkillId === node.id) || (isMobileLandscape && tooltipData?.skillId === node.id)}
                      canRemove={canRemove}
                      treeColor={treeSettings?.D?.color ?? '#FF0000'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      isMobilePortrait={isMobilePortrait}
                      portraitActiveTree={portraitActiveTree}
                      onHover={(hover, e) => {
                        if (hover && e) {
                          const rect = (e.target as SVGElement).getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const centerY = rect.top + rect.height / 2;
                          // Calculate actual screen radius from the bounding rect (width/2 gives us the radius in screen pixels)
                          const screenRadius = rect.width / 2;
                          handleNodeHover(node.id, centerX, centerY, screenRadius);
                        } else {
                          handleNodeHover(null);
                        }
                      }}
                    />
                  );
                })}
            </g>
            )}
          </svg>


          {/* Layer 3: Point Containers (renders above nodes, below numbers) */}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute top-0 left-0 w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none', zIndex: 1001 }}
          >
            <g id="all-point-containers">
              {shouldShowContainer('tree-a-node-0') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-0', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-0"
                      d="m 312.79808,355.32718 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-0')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-1 */}
              {shouldShowContainer('tree-a-node-2-1') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-1', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-1"
                      d="m 246.03285,355.06749 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-1')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-2 */}
              {shouldShowContainer('tree-a-node-2-2') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-2', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-2"
                      d="m 232.43824,375.05615 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-2')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-3 */}
              {shouldShowContainer('tree-a-node-2-3') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-3', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-3"
                      d="m 195.8418,388.60631 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-3')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-4 */}
              {shouldShowContainer('tree-a-node-2-4') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-4', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-4"
                      d="m 142.27429,378.57747 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-4')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-5 */}
              {shouldShowContainer('tree-a-node-2-5') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-5', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-5"
                      d="m 118.29196,376.93355 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-5')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-3 */}
              {shouldShowContainer('tree-a-node-1-3') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-3', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-3"
                      d="m 200.9525,325.45013 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-3')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 3-1 */}
              {shouldShowContainer('tree-a-node-3-1') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-3-1', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-3-1"
                      d="m 144.50095,347.26454 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-3-1')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-4 */}
              {shouldShowContainer('tree-a-node-1-4') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-4', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-4"
                      d="m 146.84125,315.62514 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-4')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-1 */}
              {shouldShowContainer('tree-a-node-1-1') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-1', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-1"
                      d="m 260.60424,324.39817 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-1')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-5 */}
              {shouldShowContainer('tree-a-node-1-5') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-5', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-5"
                      d="m 122.89979,313.47799 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-5')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 3-2 */}
              {shouldShowContainer('tree-a-node-3-2') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-3-2', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-3-2"
                      d="m 120.86118,345.21238 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-3-2')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-6 3-3 */}
              {shouldShowContainer('tree-a-node-1-6-3-3') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-6-3-3', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-6-3-3"
                      d="m 69.205264,315.59659 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-6-3-3')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 1-2 */}
              {shouldShowContainer('tree-a-node-1-2') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-1-2', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-1-2"
                      d="m 236.37767,322.68423 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-1-2')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree A container node 2-6 3-3 */}
              {shouldShowContainer('tree-a-node-2-6-3-3') && (() => {
                const pos = getNodeTransformedPosition('tree-a-node-2-6-3-3', 'A');
                return (
                  <g transform={getContainerTransform('A', pos.x, pos.y)}>
                    <path
                      id="container-a-2-6-3-3"
                      d="m 63.954124,378.74926 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                      fill="#090c19"
                      stroke={getNodeColor('tree-a-node-2-6-3-3')}
                      strokeWidth="0.7"
                      opacity="1"
                    />
                  </g>
                );
              })()}
              {/* Tree B container node 0 */}
              {shouldShowContainer('tree-b-node-0') && (() => { const pos = getNodeTransformedPosition('tree-b-node-0', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-0" d="m 341.58229,294.94427 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-0')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-1 */}
              {shouldShowContainer('tree-b-node-1-1') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-1', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-1" d="m 283.75772,279.87217 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-2 */}
              {shouldShowContainer('tree-b-node-1-2') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-2', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-2" d="m 262.81805,268.09611 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-1 */}
              {shouldShowContainer('tree-b-node-2-1') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-1', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-1" d="m 289.07237,246.20217 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-2 */}
              {shouldShowContainer('tree-b-node-2-2') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-2', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-2" d="m 289.42091,222.30439 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-3 */}
              {shouldShowContainer('tree-b-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-3', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-3" d="m 263.59166,201.16109 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-3 */}
              {shouldShowContainer('tree-b-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-3', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-3" d="m 231.70546,256.12849 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 3-1 */}
              {shouldShowContainer('tree-b-node-3-1') && (() => { const pos = getNodeTransformedPosition('tree-b-node-3-1', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-3-1" d="m 201.13889,195.70248 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-3-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-4 */}
              {shouldShowContainer('tree-b-node-2-4') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-4', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-4" d="m 216.79077,167.86576 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-4')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-5 */}
              {shouldShowContainer('tree-b-node-2-5') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-5', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-5" d="m 196.10315,155.90176 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-5')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 3-2 */}
              {shouldShowContainer('tree-b-node-3-2') && (() => { const pos = getNodeTransformedPosition('tree-b-node-3-2', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-3-2" d="m 180.38959,183.89809 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-3-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-5 */}
              {shouldShowContainer('tree-b-node-1-5') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-5', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-5" d="m 164.20784,211.23139 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-5')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-6 3-3 */}
              {shouldShowContainer('tree-b-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-6-3-3', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-6-3-3" d="m 117.87634,189.87252 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-6-3-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 2-6 3-3 */}
              {shouldShowContainer('tree-b-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-6-3-3', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-2-6-3-3" d="m 149.44436,134.89921 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-2-6-3-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree B container node 1-4 */}
              {shouldShowContainer('tree-b-node-1-4') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-4', 'B'); return (
                <g transform={getContainerTransform('B', pos.x, pos.y)}>
                  <path id="container-b-1-4" d="m 185.14524,223.04544 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-b-node-1-4')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree C container node 0 */}
              {shouldShowContainer('tree-c-node-0') && (
                <path
                  id="container-c-0"
                  d="m 379.2802,274.00862 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-0')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-1 */}
              {shouldShowContainer('tree-c-node-2-1') && (
                <path
                  id="container-c-2-1"
                  d="m 421.72792,222.75379 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-1')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-2 */}
              {shouldShowContainer('tree-c-node-2-2') && (
                <path
                  id="container-c-2-2"
                  d="m 421.76623,200.20684 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-2')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-1 */}
              {shouldShowContainer('tree-c-node-1-1') && (
                <path
                  id="container-c-1-1"
                  d="m 336.90689,223.15684 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-1')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-3 */}
              {shouldShowContainer('tree-c-node-1-3') && (
                <path
                  id="container-c-1-3"
                  d="m 358.50838,183.64446 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-3')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-3 */}
              {shouldShowContainer('tree-c-node-2-3') && (
                <path
                  id="container-c-2-3"
                  d="m 400.52994,183.92975 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-3')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-6 3-3 */}
              {shouldShowContainer('tree-c-node-2-6-3-3') && (
                <path
                  id="container-c-2-6-3-3"
                  d="m 400.4042,70.553613 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-6-3-3')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-6 3-3 */}
              {shouldShowContainer('tree-c-node-1-6-3-3') && (
                <path
                  id="container-c-1-6-3-3"
                  d="m 358.57252,70.07087 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-6-3-3')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-5 */}
              {shouldShowContainer('tree-c-node-1-5') && (
                <path
                  id="container-c-1-5"
                  d="m 336.93804,109.77631 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-5')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-4 */}
              {shouldShowContainer('tree-c-node-1-4') && (
                <path
                  id="container-c-1-4"
                  d="m 336.72948,132.63913 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-4')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 3-2 */}
              {shouldShowContainer('tree-c-node-3-2') && (
                <path
                  id="container-c-3-2"
                  d="m 379.23155,110.13207 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-3-2')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 3-1 */}
              {shouldShowContainer('tree-c-node-3-1') && (
                <path
                  id="container-c-3-1"
                  d="m 379.42786,132.93581 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-3-1')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-4 */}
              {shouldShowContainer('tree-c-node-2-4') && (
                <path
                  id="container-c-2-4"
                  d="m 421.84324,132.66155 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-4')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 2-5 */}
              {shouldShowContainer('tree-c-node-2-5') && (
                <path
                  id="container-c-2-5"
                  d="m 421.84553,110.17747 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-2-5')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree C container node 1-2 */}
              {shouldShowContainer('tree-c-node-1-2') && (
                <path
                  id="container-c-1-2"
                  d="m 337.18076,200.17247 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z"
                  fill="#090c19"
                  stroke={getNodeColor('tree-c-node-1-2')}
                  strokeWidth="0.7"
                  opacity="1"
                />
              )}
              {/* Tree D container node 0 */}
              {shouldShowContainer('tree-d-node-0') && (() => { const pos = getNodeTransformedPosition('tree-d-node-0', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-0" d="m 433.14292,303.97127 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-0')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-1 */}
              {shouldShowContainer('tree-d-node-1-1') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-1', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-1" d="m 490.36254,289.22477 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-2 */}
              {shouldShowContainer('tree-d-node-1-2') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-2', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-2" d="m 511.47468,277.73166 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-3 */}
              {shouldShowContainer('tree-d-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-3', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-3" d="m 542.58364,265.6915 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-1 */}
              {shouldShowContainer('tree-d-node-2-1') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-1', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-1" d="m 484.69802,256.20866 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-2 */}
              {shouldShowContainer('tree-d-node-2-2') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-2', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-2" d="m 484.79936,231.61201 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-4 */}
              {shouldShowContainer('tree-d-node-2-4') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-4', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-4" d="m 557.11276,177.25914 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-4')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-3 */}
              {shouldShowContainer('tree-d-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-3', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-3" d="m 510.27865,210.11988 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-4 */}
              {shouldShowContainer('tree-d-node-1-4') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-4', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-4" d="m 589.10304,233.07716 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-4')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-5 */}
              {shouldShowContainer('tree-d-node-1-5') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-5', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-5" d="m 609.60112,220.78385 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-5')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 3-1 */}
              {shouldShowContainer('tree-d-node-3-1') && (() => { const pos = getNodeTransformedPosition('tree-d-node-3-1', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-3-1" d="m 573.20733,205.55815 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-3-1')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-5 */}
              {shouldShowContainer('tree-d-node-2-5') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-5', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-5" d="m 578.06897,165.47027 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-5')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 3-2 */}
              {shouldShowContainer('tree-d-node-3-2') && (() => { const pos = getNodeTransformedPosition('tree-d-node-3-2', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-3-2" d="m 593.78347,193.02282 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-3-2')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 1-6 3-3 */}
              {shouldShowContainer('tree-d-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-6-3-3', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-1-6-3-3" d="m 656.454,198.93673 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-1-6-3-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
              {/* Tree D container node 2-6 3-3 */}
              {shouldShowContainer('tree-d-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-6-3-3', 'D'); return (
                <g transform={getContainerTransform('D', pos.x, pos.y)}>
                  <path id="container-d-2-6-3-3" d="m 625.03868,144.48747 c 0,0 3.15923,0.0973 3.58841,1.4e-4 0.42919,-0.0972 3.09232,-0.76068 3.10885,-3.70417 0.0164,-2.94349 -2.497,-4.00183 -3.27421,-4.01836 -0.77722,-0.0164 -7.24297,-0.0332 -7.24297,-0.0332 0,0 -2.97657,0.46302 -3.00964,3.93568 -0.0331,3.47266 3.09232,3.75378 3.09232,3.75378 z" fill="#090c19" stroke={getNodeColor('tree-d-node-2-6-3-3')} strokeWidth="0.7" opacity="1" />
                </g>
              ); })()}
            </g>
          </svg>


          {/* Layer 4: Lock Icons (renders above containers, below numbers) */}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute top-0 left-0 w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none', zIndex: 1002 }}
          >
            {/* All Lock icons - 16 total across all trees */}
            {/* Only show locks for gated/locked nodes */}
            <g id="all-lock-icons">
              {/* Tree A lock 2-3 */}
              {shouldShowLock('tree-a-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-a-node-2-3', 'A'); return (
                <g id="lock-a-2-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('A', -34.969545, 133.64048, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-a-node-2-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-a-node-2-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-79"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-5"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-5" /></g>
              ); })()}
              {/* Tree A lock 1-3 */}
              {shouldShowLock('tree-a-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-a-node-1-3', 'A'); return (
                <g id="lock-a-1-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('A', -31.389998, 69.838135, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-a-node-1-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-a-node-1-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-79-1"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-5-6"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-5-3" /></g>
              ); })()}
              {/* Tree A lock 2-6 3-3 */}
              {shouldShowLock('tree-a-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-a-node-2-6-3-3', 'A'); return (
                <g id="lock-a-2-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('A', -167.63311, 124.05908, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-a-node-2-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-a-node-2-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-79-1-3"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-5-6-0"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-5-3-7" /></g>
              ); })()}
              {/* Tree A lock 1-6 3-3 */}
              {shouldShowLock('tree-a-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-a-node-1-6-3-3', 'A'); return (
                <g id="lock-a-1-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('A', -161.7236, 60.537817, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-a-node-1-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-a-node-1-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-79-1-3-9"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-5-6-0-8"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-5-3-7-5" /></g>
              ); })()}
              {/* Tree B lock 1-3 */}
              {shouldShowLock('tree-b-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-3', 'B'); return (
                <g id="lock-b-1-3" transform={getLockTransform('B', 0, 0, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-b-node-1-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-b-node-1-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104" /></g>
              ); })()}
              {/* Tree B lock 2-3 */}
              {shouldShowLock('tree-b-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-3', 'B'); return (
                <g id="lock-b-2-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('B', 31.600865, -55.033637, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-b-node-2-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-b-node-2-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3" /></g>
              ); })()}
              {/* Tree B lock 2-6 3-3 */}
              {shouldShowLock('tree-b-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-2-6-3-3', 'B'); return (
                <g id="lock-b-2-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('B', -82.302265, -121.31177, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-b-node-2-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-b-node-2-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8" /></g>
              ); })()}
              {/* Tree B lock 1-6 3-3 */}
              {shouldShowLock('tree-b-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-b-node-1-6-3-3', 'B'); return (
                <g id="lock-b-1-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('B', -114.31685, -66.013845, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-b-node-1-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-b-node-1-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0" /></g>
              ); })()}
              {/* Tree C lock 1-3 */}
              {shouldShowLock('tree-c-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-c-node-1-3', 'C'); return (
                <g id="lock-c-1-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('C', 125.9873, -72.424544, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-c-node-1-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-c-node-1-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5" /></g>
              ); })()}
              {/* Tree C lock 2-3 */}
              {shouldShowLock('tree-c-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-c-node-2-3', 'C'); return (
                <g id="lock-c-2-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('C', 168.35671, -71.930312, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-c-node-2-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-c-node-2-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-5"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-4"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-7" /></g>
              ); })()}
              {/* Tree C lock 1-6 3-3 */}
              {shouldShowLock('tree-c-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-c-node-1-6-3-3', 'C'); return (
                <g id="lock-c-1-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('C', 126.31228, -184.59419, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-c-node-1-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-c-node-1-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5" /></g>
              ); })()}
              {/* Tree C lock 2-6 3-3 */}
              {shouldShowLock('tree-c-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-c-node-2-6-3-3', 'C'); return (
                <g id="lock-c-2-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('C', 168.75428, -185.34576, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-c-node-2-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-c-node-2-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7-9"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2-5"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5-7" /></g>
              ); })()}
              {/* Tree D lock 2-3 */}
              {shouldShowLock('tree-d-node-2-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-3', 'D'); return (
                <g id="lock-d-2-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('D', 279.08136, -44.725905, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-d-node-2-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-d-node-2-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7-2"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2-1"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5-0" /></g>
              ); })()}
              {/* Tree D lock 1-3 */}
              {shouldShowLock('tree-d-node-1-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-3', 'D'); return (
                <g id="lock-d-1-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('D', 311.52653, 11.301172, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-d-node-1-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-d-node-1-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7-2-6"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2-1-6"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5-0-8" /></g>
              ); })()}
              {/* Tree D lock 1-6 3-3 */}
              {shouldShowLock('tree-d-node-1-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-1-6-3-3', 'D'); return (
                <g id="lock-d-1-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('D', 424.15886, -55.877901, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-d-node-1-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-d-node-1-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7-2-7"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2-1-0"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5-0-2" /></g>
              ); })()}
              {/* Tree D lock 2-6 3-3 */}
              {shouldShowLock('tree-d-node-2-6-3-3') && (() => { const pos = getNodeTransformedPosition('tree-d-node-2-6-3-3', 'D'); return (
                <g id="lock-d-2-6 3-3"
                         style={{ display: "inline" }}
                         transform={getLockTransform('D', 392.78359, -111.11846, pos.x, pos.y)}><ellipse
                           style={{ opacity: 1, mixBlendMode: "normal", fill: getLockColor('tree-d-node-2-6-3-3'), fillOpacity: 1, fillRule: "nonzero", stroke: getLockColor('tree-d-node-2-6-3-3'), strokeWidth: 0.9, strokeDasharray: "none", strokeOpacity: 1 }}
                           id="path103-8-9-7-6-7-2-7-5"
                           cx="221.57201"
                           cy="247.53424"
                           rx="5.3743491"
                           ry="5.1593747" /><rect
                           style={{ opacity: 1, fill: "#090c19", fillOpacity: 1, stroke: "none", strokeWidth: 0.899999 }}
                           id="rect103-9-6-1-8-2-1-0-6"
                           width="4.8520966"
                           height="3.1253905"
                           x="219.17422"
                           y="247.36888"
                           ry="0.14882609"
                           rx="0.14882812" /><path style={{ opacity: 1, fill: "none", fillOpacity: 1, stroke: "#090c19", strokeWidth: 0.8, strokeLinecap: "round" }} d="m 220.41445,246.50898 c 0,0 -0.1819,-1.83555 1.20716,-1.81901 1.38906,0.0165 1.20716,1.81901 1.20716,1.81901" id="path104-3-8-0-5-5-0-2-1" /></g>
              ); })()}
            </g>
          </svg>

          
          {/* Layer 5: Point Numbers (TOP LAYER - renders above everything) */}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute top-0 left-0 w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none', zIndex: 1003 }}
          >
            {/* Dynamically render numbers for all multi-point nodes */}

            {/* Tree B Numbers */}
            {isTreeVisible('B') && (
            <g transform="translate(221.93716,39.335736)">
              {filteredNodes
                .filter((n) => n.tree === 'B' && (n.maxPoints ?? 1) > 1)
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

                  // Hide if locked or max points reached
                  if (skillState === 'locked' || currentPoints >= (node.maxPoints ?? 1)) return null;

                  const textY = node.y + node.radius + 2.0;
                  const rotation = getPortraitCounterRotation('B');

                  return (
                    <text
                      key={`num-${node.id}`}
                      x={node.x}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={getNodeColor(node.id)}
                      fontSize="5.5"
                      fontWeight="700"
                      fontFamily="var(--font-montserrat)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      transform={rotation !== 0 ? `rotate(${rotation}, ${node.x}, ${node.y})` : undefined}
                    >
                      {currentPoints}/{node.maxPoints ?? 1}
                    </text>
                  );
                })}
            </g>
            )}

            {/* Tree A Numbers */}
            {isTreeVisible('A') && (
            <g>
              {filteredNodes
                .filter((n) => n.tree === 'A' && (n.maxPoints ?? 1) > 1)
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

                  // Hide if locked or max points reached
                  if (skillState === 'locked' || currentPoints >= (node.maxPoints ?? 1)) return null;

                  // Apply transformation to position, then counter-rotate text
                  const a = 0.82544171, b = 0.56448736, c = 0.56221371, d = -0.82211698, e = 81.266847, f = 463.85256;
                  const transformedX = a * node.x + c * node.y + e;
                  const transformedY = b * node.x + d * node.y + f;
                  const textY = transformedY + node.radius + 2.0;
                  const rotation = getPortraitCounterRotation('A');

                  return (
                    <text
                      key={`num-${node.id}`}
                      x={transformedX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={getNodeColor(node.id)}
                      fontSize="5.5"
                      fontWeight="700"
                      fontFamily="var(--font-montserrat)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      transform={rotation !== 0 ? `rotate(${rotation}, ${transformedX}, ${transformedY})` : undefined}
                    >
                      {currentPoints}/{node.maxPoints ?? 1}
                    </text>
                  );
                })}
            </g>
            )}

            {/* Tree C Numbers */}
            {isTreeVisible('C') && (
            <g transform="translate(221.93716,39.335736)">
              {filteredNodes
                .filter((n) => n.tree === 'C' && (n.maxPoints ?? 1) > 1)
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

                  // Hide if locked or max points reached
                  if (skillState === 'locked' || currentPoints >= (node.maxPoints ?? 1)) return null;

                  return (
                    <text
                      key={`num-${node.id}`}
                      x={node.x}
                      y={node.y + node.radius + 2.0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={getNodeColor(node.id)}
                      fontSize="5.5"
                      fontWeight="700"
                      fontFamily="var(--font-montserrat)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {currentPoints}/{node.maxPoints ?? 1}
                    </text>
                  );
                })}
            </g>
            )}

            {/* Tree D Numbers */}
            {isTreeVisible('D') && (
            <g>
              {filteredNodes
                .filter((n) => n.tree === 'D' && (n.maxPoints ?? 1) > 1)
                .map((node) => {
                  const currentPoints = getSkillPoints(node.id);
                  const totalTreePoints = getTotalTreePoints(node.tree);
                  const skillState = getSkillState(node, state.skillPoints, totalTreePoints, effectiveNodes);

                  // Hide if locked or max points reached
                  if (skillState === 'locked' || currentPoints >= (node.maxPoints ?? 1)) return null;

                  // Apply horizontal flip transformation: matrix(-1,0,0,1,552.10903,48.512262)
                  const transformedX = -1 * node.x + 552.10903;
                  const transformedY = node.y + 48.512262;
                  const textY = transformedY + node.radius + 2.0;
                  const rotation = getPortraitCounterRotation('D');

                  return (
                    <text
                      key={`num-${node.id}`}
                      x={transformedX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={getNodeColor(node.id)}
                      fontSize="5.5"
                      fontWeight="700"
                      fontFamily="var(--font-montserrat)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      transform={rotation !== 0 ? `rotate(${rotation}, ${transformedX}, ${transformedY})` : undefined}
                    >
                      {currentPoints}/{node.maxPoints ?? 1}
                    </text>
                  );
                })}
            </g>
            )}

            {/* Tree Titles - Hidden in mobile portrait mode (shown in bottom card instead) */}
            {!isMobilePortrait && (
            <g id="tree-titles">
              {(['A', 'B', 'C', 'D'] as const).map(tree => {
                if (!isTreeVisible(tree)) return null;

                const titleData = treeTitles[tree];
                if (!titleData) return null;

                const treeName = treeSettings?.[tree]?.name || '';
                const treeColor = treeSettings?.[tree]?.color || '#ffffff';
                const totalPoints = getTotalTreePoints(tree);

                return (
                  <g key={`title-${tree}`}>
                    <text
                      ref={(el) => {
                        if (el) {
                          const bbox = el.getBBox();
                          const centerX = titleData.x + bbox.width / 2;
                          // Update the number position to center under title
                          const numberEl = el.nextElementSibling as SVGTextElement;
                          if (numberEl) {
                            numberEl.setAttribute('x', centerX.toString());
                          }
                        }
                      }}
                      x={titleData.x}
                      y={titleData.y + titleData.height / 2 - 2}
                      fill={treeColor}
                      fontSize="10"
                      fontWeight="500"
                      fontFamily="var(--font-montserrat)"
                      textAnchor="start"
                      dominantBaseline="alphabetic"
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}
                    >
                      {treeName}
                    </text>
                    <text
                      x={titleData.x}
                      y={titleData.y + titleData.height / 2 + 2}
                      fill={treeColor}
                      fontSize="14"
                      fontWeight="900"
                      fontFamily="var(--font-montserrat)"
                      textAnchor="middle"
                      dominantBaseline="hanging"
                    >
                      {totalPoints}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          </svg>



        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipData && (() => {
          const tooltipSkill = effectiveNodes.find(n => n.id === tooltipData.skillId);
          const tooltipTreePoints = tooltipSkill ? getTotalTreePoints(tooltipSkill.tree) : 0;
          const tooltipCanAdd = tooltipSkill ? canAddPoint(tooltipSkill, state.skillPoints, tooltipTreePoints, effectiveNodes) : false;
          const tooltipCanRemove = canRemovePoint(tooltipData.skillId, state.skillPoints, effectiveNodes);

          return (
            <SkillTooltip
              key={tooltipData.skillId}
              skillId={tooltipData.skillId}
              x={tooltipData.x}
              y={tooltipData.y}
              position={tooltipData.position}
              effectiveNodes={effectiveNodes}
              treeSettings={treeSettings}
              onMeasure={handleTooltipMeasure}
              visible={tooltipData.measured}
              compact={isMobileLandscape}
              isMobileLandscape={isMobileLandscape}
              canAdd={tooltipCanAdd}
              canRemove={tooltipCanRemove}
              onAddPoint={() => addPoint(tooltipData.skillId)}
              onRemovePoint={() => removePoint(tooltipData.skillId)}
            />
          );
        })()}
      </AnimatePresence>

      {/* Bokeh Particles - Fixed screen positions (behind trees) */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1 }}
        suppressHydrationWarning
      >
        {bokehParticles.length > 0 && (
          <style dangerouslySetInnerHTML={{
            __html: bokehParticles.map(particle => {
              if (particle.waypoints && particle.waypoints.length > 0) {
                // Generate keyframes with waypoints for direction changes
                const waypointFrames = particle.waypoints.map(wp =>
                  `${wp.percent}% { transform: translate3d(${wp.x}vw, ${wp.y}vh, 0); opacity: 0.5; }`
                ).join('\n                ');
                return `
              @keyframes bokeh-${particle.id} {
                0% { transform: translate3d(0, 0, 0); opacity: 0; }
                5% { opacity: 0.5; }
                ${waypointFrames}
                92% { opacity: 0.45; }
                96% { opacity: 0.3; }
                98% { opacity: 0.15; }
                99% { opacity: 0.06; }
                100% { transform: translate3d(${particle.driftX}vw, ${particle.driftY}vh, 0); opacity: 0; }
              }
            `;
              }
              return `
              @keyframes bokeh-${particle.id} {
                0% { transform: translate3d(0, 0, 0); opacity: 0; }
                5% { opacity: 0.5; }
                92% { opacity: 0.45; }
                96% { opacity: 0.3; }
                98% { opacity: 0.15; }
                99% { opacity: 0.06; }
                100% { transform: translate3d(${particle.driftX}vw, ${particle.driftY}vh, 0); opacity: 0; }
              }
            `;
            }).join('')
          }} />
        )}
        {bokehParticles.map((particle) => (
          <div
            key={particle.id}
            className="absolute"
            style={{
              width: `${particle.sizePercent}${isMobilePortrait ? 'vh' : 'vw'}`,
              height: `${particle.sizePercent}${isMobilePortrait ? 'vh' : 'vw'}`,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0) 75%)',
              left: `${particle.startX}vw`,
              top: `${particle.startY}vh`,
              pointerEvents: 'none',
              animationName: `bokeh-${particle.id}`,
              animationDuration: `${particle.duration}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 1,
              animationFillMode: 'forwards',
              animationDelay: `${particle.delay}s`,
              animationPlayState: (isWindowActive && !particlesPaused) ? 'running' : 'paused',
            }}
          />
        ))}
      </div>

      {/* Portrait mode bottom card - renders before isViewInitialized so card height can be measured */}
      {isMobilePortrait && portraitActiveTree && minLoadingTimePassed && (
        <div
          ref={setPortraitCardNode}
          className="fixed bottom-0 left-0 right-0 z-50"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Navigation dots - above card */}
          <div className="flex justify-center gap-2 pb-2">
            {(['A', 'B', 'C', 'D'] as const)
              .filter((tree) => !treeSettings || treeSettings[tree]?.visible !== false)
              .map((tree) => (
                <div
                  key={tree}
                  className={`w-2 h-2 rounded-full transition-all ${
                    tree === portraitActiveTree ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
          </div>
          {/* Bottom card */}
          <MobilePortraitCard
            selectedSkillId={selectedPortraitSkillId}
            effectiveNodes={effectiveNodes}
            treeSettings={treeSettings}
            portraitActiveTree={portraitActiveTree}
            canAdd={(() => {
              if (!selectedPortraitSkillId) return false;
              const skill = effectiveNodes.find(n => n.id === selectedPortraitSkillId);
              if (!skill) return false;
              const treePoints = getTotalTreePoints(skill.tree);
              return canAddPoint(skill, state.skillPoints, treePoints, effectiveNodes) && !isAtMaxPoints();
            })()}
            canRemove={selectedPortraitSkillId ? canRemovePoint(selectedPortraitSkillId, state.skillPoints, effectiveNodes) : false}
            onAddPoint={() => {
              if (selectedPortraitSkillId) {
                addPoint(selectedPortraitSkillId);
              }
            }}
            onRemovePoint={() => {
              if (selectedPortraitSkillId) {
                removePoint(selectedPortraitSkillId);
              }
            }}
            totalPoints={(['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)}
            maxPoints={getMaxSkillPoints()}
            pointsDisplayMode={pointsDisplayMode}
            onTogglePointsDisplayMode={() => setPointsDisplayMode(prev => prev === 'spent' ? 'remaining' : 'spent')}
            isMaxPointsFlash={isMaxPointsFlash}
          />
        </div>
      )}


      {/* Skill Points indicator - top right (hidden in portrait mode - shown in bottom card) */}
      {minLoadingTimePassed && isViewInitialized && !isMobilePortrait && (
        <div
          className={`fixed z-50 flex items-center gap-4 ${
            isMobileLandscape
              ? 'top-2 right-4'
              : 'top-4 right-10'
          }`}
          style={{ fontFamily: 'var(--font-montserrat)' }}
        >
          {/* Contact/Envelope Button - hidden in mobile landscape */}
          {!isMobileLandscape && (
            <button
              onClick={() => window.open('https://github.com/marienbaptiste/arcraidersskilltree', '_blank')}
              className="text-white/70 hover:text-white transition-colors"
              title="View on GitHub"
            >
              <svg className="w-8 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ transform: 'scale(1.2) scaleX(1.2)' }}>
                {/* Open envelope icon with flap up */}
                {/* Envelope body (bottom rectangle) */}
                <path d="M2 10v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10l-10 6-10-6z"/>
                {/* Inner triangle fold lines (V shape inside envelope) */}
                <path d="M2 10l10 6 10-6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                {/* Open flap (triangle pointing up) */}
                <path d="M22 10l-10-8-10 8"/>
              </svg>
            </button>
          )}
          {/* Circular progress ring with points and label */}
          {/* Smaller in mobile landscape mode, clickable to toggle on desktop */}
          {isMobileLandscape ? (
            // Mobile landscape: compact tappable display (80% bigger than original)
            <button
              className="flex items-center gap-1.5"
              onClick={() => setPointsDisplayMode(prev => prev === 'spent' ? 'remaining' : 'spent')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative w-[43px] h-[43px]">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill={isMaxPointsFlash ? '#f5b942' : 'none'}
                    stroke={isMaxPointsFlash ? '#f5b942' : '#5a5a5a'}
                    strokeWidth="4"
                    style={{ transition: 'fill 0.15s ease-out, stroke 0.15s ease-out' }}
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#f5b942"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={pointsDisplayMode === 'spent'
                      ? `${((['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0) / getMaxSkillPoints()) * 88} 88`
                      : `${((getMaxSkillPoints() - (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)) / getMaxSkillPoints()) * 88} 88`
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-semibold text-[14px]"
                    style={{
                      color: isMaxPointsFlash ? '#0f1729' : 'white',
                      transition: 'color 0.15s ease-out'
                    }}
                  >
                    {pointsDisplayMode === 'spent'
                      ? (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)
                      : getMaxSkillPoints() - (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)
                    }
                  </span>
                </div>
              </div>
              <span className="text-white/90 font-medium text-[14px] w-10">
                {pointsDisplayMode === 'spent' ? 'Spent' : 'Left'}
              </span>
            </button>
          ) : (
            // Desktop: full interactive display
            <button
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setPointsDisplayMode(prev => prev === 'spent' ? 'remaining' : 'spent')}
              title={pointsDisplayMode === 'spent' ? 'Click to show remaining points' : 'Click to show spent points'}
            >
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle - flashes yellow when at max */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill={isMaxPointsFlash ? '#f5b942' : 'none'}
                    stroke={isMaxPointsFlash ? '#f5b942' : '#5a5a5a'}
                    strokeWidth="4"
                    style={{ transition: 'fill 0.15s ease-out, stroke 0.15s ease-out' }}
                  />
                  {/* Progress circle - shows spent or remaining based on mode */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#f5b942"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={pointsDisplayMode === 'spent'
                      ? `${((['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0) / getMaxSkillPoints()) * 88} 88`
                      : `${((getMaxSkillPoints() - (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)) / getMaxSkillPoints()) * 88} 88`
                    }
                  />
                </svg>
                {/* Number in center - spent or remaining based on mode, blue when flashing */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-semibold text-xl"
                    style={{
                      color: isMaxPointsFlash ? '#0f1729' : 'white',
                      transition: 'color 0.15s ease-out'
                    }}
                  >
                    {pointsDisplayMode === 'spent'
                      ? (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)
                      : getMaxSkillPoints() - (['A', 'B', 'C', 'D'] as TreeType[]).reduce((sum, tree) => sum + getTotalTreePoints(tree), 0)
                    }
                  </span>
                </div>
              </div>
              {/* Label */}
              <span className="text-white/90 text-xl font-medium pr-6">
                {pointsDisplayMode === 'spent' ? 'Skill Points Spent' : 'Skill Points Left'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
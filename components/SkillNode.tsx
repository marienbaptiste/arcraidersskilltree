'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { SkillNode, SkillState } from '@/types/skills';

interface SkillNodeProps {
  node: SkillNode;
  skillState: SkillState;
  currentPoints: number;
  isHovered: boolean;
  canRemove: boolean;
  treeColor: string;
  onClick: (e: React.MouseEvent) => void;
  onHover: (hover: boolean, e?: React.MouseEvent<SVGCircleElement>) => void;
  isMobilePortrait?: boolean;
  portraitActiveTree?: string | null;
}

export default function SkillNodeComponent({
  node,
  skillState,
  currentPoints,
  isHovered,
  canRemove,
  treeColor,
  onClick,
  onHover,
  isMobilePortrait,
  portraitActiveTree,
}: SkillNodeProps) {
  // Tooltip yellow color for hover state
  const hoverColor = '#f5f0dc';

  // Color schemes based on state
  const getColors = () => {
    const isMaxPoints = currentPoints === (node.maxPoints ?? 1) && currentPoints > 0;

    // Override stroke color when hovered
    if (isHovered) {
      return {
        stroke: hoverColor,
        fill: isMaxPoints ? treeColor : '#090C19',
        glowColor: hoverColor,
      };
    }

    switch (skillState) {
      case 'unlocked':
        // If max points spent in this node, use tree color for fill
        if (isMaxPoints) {
          return {
            stroke: treeColor,
            fill: treeColor,
            glowColor: treeColor,
          };
        }
        // Otherwise, tree color stroke but dark fill
        return {
          stroke: treeColor,
          fill: '#090C19',
          glowColor: treeColor,
        };
      case 'available':
        return {
          stroke: treeColor,
          fill: '#090C19',
          glowColor: treeColor,
        };
      case 'locked':
      default:
        return {
          stroke: '#6c7074', // gray
          fill: '#090C19',
          glowColor: '#6c7074',
        };
    }
  };

  const colors = getColors();
  const strokeWidth = node.isKeyNode ? 1.3 : 0.9;
  const cursorStyle = (skillState === 'available' || (skillState === 'unlocked' && canRemove)) ? 'pointer' : 'default';

  // Show point count if maxPoints > 1
  const showPointCount = (node.maxPoints ?? 1) > 1;

  // Determine icon color based on points invested
  const getIconColor = () => {
    if (currentPoints === 0) {
      return '#858a8e'; // Medium gray for locked nodes
    } else if (currentPoints < (node.maxPoints ?? 1)) {
      return treeColor; // Tree color for partial investment
    } else {
      return '#000000'; // Pure black for max points
    }
  };

  const iconColor = getIconColor();
  const filterId = `icon-color-${node.id}`;

  // Scale icon size based on node radius - smaller multiplier for smaller nodes
  const getIconScale = () => {
    if (node.radius < 8) {
      return 1.5; // Smaller nodes get smaller icons
    } else if (node.radius < 12) {
      return 1.7; // Medium nodes get medium icons
    } else {
      return 1.6; // Large nodes (keynodes) get smaller icons relative to their size
    }
  };

  const iconScale = getIconScale();
  const iconSize = node.radius * iconScale;
  const iconOffset = iconSize / 2;

  // Calculate counter-rotation for portrait mode
  const getIconTransform = () => {
    // Tree A matrix: (0.82544171, 0.56448736, 0.56221371, -0.82211698, ...)
    // Base rotation from matrix: atan2(b, a) = 34.3667°
    const TREE_A_BASE_ROTATION = 34.3667;

    if (!isMobilePortrait || !portraitActiveTree) {
      // Not in portrait mode - apply counter-rotation and flips for Trees A and D
      if (node.tree === 'A') {
        // Tree A has matrix transform with ~34.3667° rotation + vertical flip
        // Counter-rotate by -34.3667° and flip vertically
        // Apply transformations in the order that makes sense: flip then rotate
        return `scale(1, -1) rotate(-${TREE_A_BASE_ROTATION}, ${node.x}, ${-node.y}) translate(0, ${-2 * node.y})`;
      }
      if (node.tree === 'D') {
        // Tree D has horizontal flip in its matrix transform
        return `scale(-1, 1) translate(${-2 * node.x}, 0)`;
      }
      return '';
    }

    // In portrait mode, counter-rotate the icon to keep it upright
    const rotations: Record<string, number> = {
      A: -86.174394,  // Portrait rotation for Tree A
      B: -59.784596,
      C: 0,
      D: 60.054601
    };
    const counterRotation = rotations[node.tree] || 0;

    // Tree A needs vertical flip + rotation in portrait mode (due to matrix transform with negative d value)
    // Use the same base rotation as desktop mode (-34.3667°) plus the portrait counter-rotation
    if (node.tree === 'A') {
      const totalRotation = -TREE_A_BASE_ROTATION + counterRotation;
      return `scale(1, -1) rotate(${totalRotation}, ${node.x}, ${-node.y}) translate(0, ${-2 * node.y})`;
    }

    // Tree D needs horizontal flip + rotation in portrait mode
    if (node.tree === 'D') {
      return `scale(-1, 1) rotate(${counterRotation}, ${-node.x}, ${node.y}) translate(${-2 * node.x}, 0)`;
    }

    // Apply counter-rotation around the node's center point
    return `rotate(${counterRotation}, ${node.x}, ${node.y})`;
  };

  const iconTransform = getIconTransform();

  return (
    <g>
      {/* SVG filter for recoloring the icon - blur removed for better performance */}
      {node.iconPath && (
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0" intercept={parseInt(iconColor.slice(1, 3), 16) / 255} />
              <feFuncG type="linear" slope="0" intercept={parseInt(iconColor.slice(3, 5), 16) / 255} />
              <feFuncB type="linear" slope="0" intercept={parseInt(iconColor.slice(5, 7), 16) / 255} />
            </feComponentTransfer>
          </filter>
        </defs>
      )}

      {/* Main skill node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        style={{ cursor: cursorStyle }}
        data-skill-id={node.id}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        }}
        onMouseEnter={(e) => onHover(true, e)}
        onMouseLeave={() => onHover(false)}
        className="pointer-events-auto"
      />

      {/* Icon overlay - displayed on top of node */}
      {node.iconPath && (
        <image
          href={node.iconPath}
          x={node.x - iconOffset}
          y={node.y - iconOffset}
          width={iconSize}
          height={iconSize}
          opacity={skillState === 'locked' ? 0.45 : 1}
          filter={`url(#${filterId})`}
          transform={iconTransform}
          style={{
            pointerEvents: 'none',
            imageRendering: 'auto'
          }}
        />
      )}

      {/* Point count display removed - now rendered in top layer of SkillTree.tsx */}
    </g>
  );
}

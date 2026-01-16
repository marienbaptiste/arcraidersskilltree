/**
 * Skill tree logic functions for points-based system
 * Handles skill state calculations, validation, and dependency checks
 */

import { SkillNode, TreeType } from '@/types/skills';

/**
 * Get skill state based on current point allocation and prerequisites
 * @param skill - The skill node to check
 * @param skillPoints - Map of skill ID to allocated points
 * @param totalTreePoints - Total points allocated in the skill's tree
 * @param skillNodes - All skill nodes for dependency lookups
 */
export function getSkillState(
  skill: SkillNode,
  skillPoints: Map<string, number>,
  totalTreePoints: number,
  skillNodes: SkillNode[]
): 'locked' | 'available' | 'unlocked' {
  const currentPoints = skillPoints.get(skill.id) || 0;

  // If skill has any points allocated, it's unlocked
  if (currentPoints > 0) {
    return 'unlocked';
  }

  // Core skills (tier 0) are always available
  if (skill.tier === 0) {
    return 'available';
  }

  // Check if we have enough points BEFORE this skill's gate
  const gateRequirement = skill.pointsRequiredInTree ?? 0;
  if (gateRequirement > 0) {
    const pointsBeforeGate = calculatePointsBeforeGate(
      skill.tree,
      gateRequirement,
      skillPoints,
      skillNodes
    );
    if (pointsBeforeGate < gateRequirement) {
      return 'locked';
    }
  }

  // Check prerequisites
  const prerequisites = skill.prerequisites;

  if (prerequisites.length === 0) {
    return 'available';
  }

  // Helper to check if a prerequisite is met
  const isPrereqMet = (prereqId: string): boolean => {
    const prereqNode = skillNodes.find(n => n.id === prereqId);
    if (!prereqNode) return false;

    // All prerequisites must have points allocated to be met
    return (skillPoints.get(prereqId) || 0) > 0;
  };

  // Check if it's OR logic (array of arrays)
  if (Array.isArray(prerequisites[0])) {
    // OR logic: At least one group must have all requirements met
    const anyGroupMet = (prerequisites as string[][]).some((group) =>
      group.every((prereqId) => isPrereqMet(prereqId))
    );
    return anyGroupMet ? 'available' : 'locked';
  } else {
    // AND logic: All prerequisites must be met
    const allPrerequisitesMet = (prerequisites as string[]).every(
      (prereqId) => isPrereqMet(prereqId)
    );
    return allPrerequisitesMet ? 'available' : 'locked';
  }
}

/**
 * Check if a point can be added to a skill
 * @returns true if point can be added, false otherwise
 */
export function canAddPoint(
  skill: SkillNode,
  skillPoints: Map<string, number>,
  totalTreePoints: number,
  skillNodes: SkillNode[]
): boolean {
  const currentPoints = skillPoints.get(skill.id) || 0;

  // Check if we've reached max points for this skill
  if (currentPoints >= (skill.maxPoints ?? 1)) {
    return false;
  }

  // If skill already has points, we can add more (up to max)
  if (currentPoints > 0) {
    return true;
  }

  // Otherwise, check if skill is available
  const state = getSkillState(skill, skillPoints, totalTreePoints, skillNodes);
  return state === 'available';
}

/**
 * Check if a point can be removed from a skill without breaking dependencies
 * @returns true if point can be removed, false otherwise
 */
export function canRemovePoint(
  skillId: string,
  skillPoints: Map<string, number>,
  skillNodes: SkillNode[]
): boolean {
  const currentPoints = skillPoints.get(skillId) || 0;

  // Can't remove if no points allocated
  if (currentPoints === 0) {
    return false;
  }

  // If removing this point would bring it to 0, check dependencies
  if (currentPoints === 1) {
    return canFullyRemoveSkill(skillId, skillPoints, skillNodes);
  }

  // Even if skill will have points after removal, check if removing one point would break tree requirements
  const skillToRemove = skillNodes.find((node) => node.id === skillId);
  if (!skillToRemove) return false;

  const skillToRemoveRequirement = skillToRemove.pointsRequiredInTree ?? 0;

  // Create temp map with one less point
  const tempPoints = new Map(skillPoints);
  tempPoints.set(skillId, currentPoints - 1);

  // Collect all unique gate requirements among allocated skills in this tree
  const gateRequirements = new Set<number>();
  for (const [allocatedSkillId, points] of skillPoints) {
    if (allocatedSkillId === skillId || points === 0) continue;

    const allocatedSkill = skillNodes.find((node) => node.id === allocatedSkillId);
    if (!allocatedSkill || allocatedSkill.tree !== skillToRemove.tree) continue;

    const gateRequirement = allocatedSkill.pointsRequiredInTree ?? 0;
    if (gateRequirement > 0) {
      gateRequirements.add(gateRequirement);
    }
  }

  // Check EACH gate requirement, not just the highest
  for (const gateRequirement of gateRequirements) {
    // Check if we're removing from before OR at this gate
    if (skillToRemoveRequirement <= gateRequirement) {
      // Calculate points before this gate after removal
      const pointsAfterRemoval = calculatePointsBeforeGate(
        skillToRemove.tree,
        gateRequirement,
        tempPoints,
        skillNodes
      );

      // Check if we'd have enough points left for this gate
      if (pointsAfterRemoval < gateRequirement) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a skill can be fully removed (all points) without breaking dependencies
 */
function canFullyRemoveSkill(
  skillId: string,
  skillPoints: Map<string, number>,
  skillNodes: SkillNode[]
): boolean {
  const skillToRemove = skillNodes.find((node) => node.id === skillId);
  if (!skillToRemove) return false;

  const pointsToRemove = skillPoints.get(skillId) || 0;

  const skillToRemoveRequirement = skillToRemove.pointsRequiredInTree ?? 0;

  // Create temporary point map without this skill
  const tempPoints = new Map(skillPoints);
  tempPoints.delete(skillId);

  // Collect all unique gate requirements among allocated skills in this tree
  const gateRequirements = new Set<number>();
  for (const [allocatedSkillId, points] of skillPoints) {
    if (allocatedSkillId === skillId || points === 0) continue;

    const allocatedSkill = skillNodes.find((node) => node.id === allocatedSkillId);
    if (!allocatedSkill || allocatedSkill.tree !== skillToRemove.tree) continue;

    const gateRequirement = allocatedSkill.pointsRequiredInTree ?? 0;
    if (gateRequirement > 0) {
      gateRequirements.add(gateRequirement);
    }
  }

  // Check EACH gate requirement, not just the highest
  for (const gateRequirement of gateRequirements) {
    // Check if we're removing from before OR at this gate
    if (skillToRemoveRequirement <= gateRequirement) {
      // Calculate points before this gate without this skill
      const pointsAfterRemoval = calculatePointsBeforeGate(
        skillToRemove.tree,
        gateRequirement,
        tempPoints,
        skillNodes
      );

      // Check if we'd have enough points left for this gate
      if (pointsAfterRemoval < gateRequirement) {
        return false;
      }
    }
  }

  // Check all skills with points to see if any would become invalid due to prerequisites
  for (const [allocatedSkillId, points] of skillPoints) {
    if (allocatedSkillId === skillId || points === 0) continue;

    const dependentSkill = skillNodes.find((node) => node.id === allocatedSkillId);
    if (!dependentSkill) continue;

    // Check if this skill depends on the one we want to remove
    const isDependent = checkSkillDependsOn(dependentSkill, skillId, tempPoints);

    if (isDependent) {
      return false; // Can't remove this skill, it would break dependencies
    }
  }

  return true; // Safe to remove
}

/**
 * Helper to check if a skill would become invalid without a specific prerequisite
 */
function checkSkillDependsOn(
  skill: SkillNode,
  requiredSkillId: string,
  currentPoints: Map<string, number>
): boolean {
  const prerequisites = skill.prerequisites;

  if (prerequisites.length === 0) {
    return false; // No prerequisites, can't depend on anything
  }

  // Check if it's OR logic (array of arrays)
  if (Array.isArray(prerequisites[0])) {
    // OR logic: Check if ALL groups would fail without this skill
    const allGroupsFail = (prerequisites as string[][]).every((group) => {
      // Check if this group contains the required skill
      if (!group.includes(requiredSkillId)) {
        // This group doesn't use the required skill, check if it's still valid
        return !group.every((prereqId) => (currentPoints.get(prereqId) || 0) > 0);
      }
      // This group does use the required skill, it will fail
      return true;
    });
    return allGroupsFail;
  } else {
    // AND logic: Check if the skill directly requires the one we want to remove
    return (prerequisites as string[]).includes(requiredSkillId);
  }
}

/**
 * Calculate total points allocated in a specific tree
 */
export function calculateTreePoints(
  treeId: TreeType,
  skillPoints: Map<string, number>,
  skillNodes: SkillNode[]
): number {
  let total = 0;
  skillPoints.forEach((points, skillId) => {
    const node = skillNodes.find((n) => n.id === skillId);
    if (node && node.tree === treeId) {
      total += points;
    }
  });
  return total;
}

/**
 * Calculate points spent in skills BEFORE a gate requirement
 * Only counts points from skills with STRICTLY LOWER pointsRequiredInTree
 * AND skills whose prerequisites don't require passing through this gate
 * This ensures points from the same tier or later don't count toward the gate
 */
function calculatePointsBeforeGate(
  treeId: TreeType,
  gateRequirement: number,
  skillPoints: Map<string, number>,
  skillNodes: SkillNode[]
): number {
  let total = 0;
  skillPoints.forEach((points, skillId) => {
    const node = skillNodes.find((n) => n.id === skillId);
    if (node && node.tree === treeId) {
      const nodeRequirement = node.pointsRequiredInTree ?? 0;

      // Only count points from skills with STRICTLY LOWER gate requirement
      if (nodeRequirement < gateRequirement) {
        // Additionally check if this skill's prerequisites require passing through the gate
        const requiresGate = hasPrerequisiteAtOrAboveGate(node, gateRequirement, skillNodes);

        if (!requiresGate) {
          total += points;
        }
      }
    }
  });
  return total;
}

/**
 * Check if a skill has any prerequisite that is at or above a gate requirement
 * This helps identify skills that are "after" a gate even if their own pointsRequiredInTree is 0
 */
function hasPrerequisiteAtOrAboveGate(
  skill: SkillNode,
  gateRequirement: number,
  skillNodes: SkillNode[]
): boolean {
  const prerequisites = skill.prerequisites;

  if (prerequisites.length === 0) {
    return false;
  }

  // Flatten prerequisites (handle both OR and AND logic)
  const prereqIds: string[] = Array.isArray(prerequisites[0])
    ? (prerequisites as string[][]).flat()
    : (prerequisites as string[]);

  // Check each prerequisite
  for (const prereqId of prereqIds) {
    const prereqNode = skillNodes.find((n) => n.id === prereqId);
    if (!prereqNode) continue;

    const prereqRequirement = prereqNode.pointsRequiredInTree ?? 0;

    // If this prerequisite is at or above the gate, this skill requires the gate
    if (prereqRequirement >= gateRequirement) {
      return true;
    }

    // Recursively check if the prerequisite itself requires the gate
    if (hasPrerequisiteAtOrAboveGate(prereqNode, gateRequirement, skillNodes)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all skills that depend on a specific skill
 */
export function getDependentSkills(
  skillId: string,
  skillNodes: SkillNode[]
): SkillNode[] {
  return skillNodes.filter((node) => {
    const prerequisites = node.prerequisites;

    if (prerequisites.length === 0) return false;

    // Check if it's OR logic (array of arrays)
    if (Array.isArray(prerequisites[0])) {
      return (prerequisites as string[][]).some((group) =>
        group.includes(skillId)
      );
    } else {
      return (prerequisites as string[]).includes(skillId);
    }
  });
}

/**
 * Validate entire skill point allocation
 * Returns array of errors if invalid, empty array if valid
 */
export function validateSkillAllocation(
  skillPoints: Map<string, number>,
  skillNodes: SkillNode[]
): string[] {
  const errors: string[] = [];

  skillPoints.forEach((points, skillId) => {
    const node = skillNodes.find((n) => n.id === skillId);

    if (!node) {
      errors.push(`Unknown skill ID: ${skillId}`);
      return;
    }

    // Check max points
    const maxPoints = node.maxPoints ?? 1;
    if (points > maxPoints) {
      errors.push(
        `${node.name} has ${points} points but max is ${maxPoints}`
      );
    }

    // Check prerequisites
    const totalTreePoints = calculateTreePoints(node.tree, skillPoints, skillNodes);
    const state = getSkillState(node, skillPoints, totalTreePoints, skillNodes);

    if (state === 'locked' && points > 0) {
      errors.push(`${node.name} is locked but has ${points} points allocated`);
    }
  });

  return errors;
}

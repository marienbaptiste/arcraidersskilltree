/**
 * URL encoding utilities for compact skill tree sharing
 *
 * Version 1 (legacy): Bitset encoding for binary unlock (backward compatible)
 * Version 2 (legacy): Point-based encoding with skill index + point count pairs
 * Version 3: Ultra-compact binary encoding with variable-length integers
 */

import { skillNodes } from '@/data/configLoader';

// Base64 URL-safe alphabet (no padding needed)
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Encodes a number to base64 URL-safe characters (variable length)
 * Uses 6 bits per character, with high bit indicating continuation
 */
function encodeVarInt(num: number): string {
  if (num < 0) return '';

  // For small numbers (0-31), use single character (5 bits data + 0 continuation)
  if (num < 32) {
    return BASE64_CHARS[num];
  }

  // For larger numbers, use continuation bit pattern
  let result = '';
  while (num > 0) {
    let chunk = num & 0x1F; // 5 bits of data
    num = num >> 5;
    if (num > 0) {
      chunk |= 0x20; // Set continuation bit
    }
    result += BASE64_CHARS[chunk];
  }
  return result;
}

/**
 * Decodes a variable-length integer from base64 URL-safe string
 * Returns [value, charsConsumed]
 */
function decodeVarInt(str: string, startIndex: number): [number, number] {
  let value = 0;
  let shift = 0;
  let index = startIndex;

  while (index < str.length) {
    const charIndex = BASE64_CHARS.indexOf(str[index]);
    if (charIndex === -1) break;

    const chunk = charIndex & 0x1F; // 5 bits of data
    value |= chunk << shift;
    shift += 5;
    index++;

    if ((charIndex & 0x20) === 0) break; // No continuation bit
  }

  return [value, index - startIndex];
}

/**
 * Encodes skill points into a compact URL parameter (Version 3)
 * Format: '3' prefix + packed binary data using base64 URL-safe chars
 * Each skill encoded as: index (varint) + points-1 (varint, only if points > 1)
 */
export function encodeSkillPointsToUrl(skillPoints: Map<string, number>): string {
  if (skillPoints.size === 0) return '';

  // Collect and sort by index for better compression of consecutive skills
  const entries: [number, number][] = [];

  skillPoints.forEach((points, skillId) => {
    const index = skillNodes.findIndex(n => n.id === skillId);
    if (index !== -1 && points > 0) {
      entries.push([index, points]);
    }
  });

  if (entries.length === 0) return '';

  // Sort by index
  entries.sort((a, b) => a[0] - b[0]);

  // Encode using delta encoding for indices (saves space for consecutive skills)
  let result = '3'; // Version 3 prefix
  let lastIndex = 0;

  for (const [index, points] of entries) {
    const delta = index - lastIndex;
    lastIndex = index;

    if (points === 1) {
      // Single point: encode delta with low bit = 0
      result += encodeVarInt(delta << 1);
    } else {
      // Multiple points: encode delta with low bit = 1, then points-2
      result += encodeVarInt((delta << 1) | 1);
      result += encodeVarInt(points - 2); // -2 because we know it's at least 2
    }
  }

  return result;
}

/**
 * Legacy encoder for version 2 (kept for reference, not used)
 */
function encodeSkillPointsV2(skillPoints: Map<string, number>): string {
  if (skillPoints.size === 0) return '';

  const encodedPairs: string[] = [];

  skillPoints.forEach((points, skillId) => {
    const index = skillNodes.findIndex(n => n.id === skillId);
    if (index !== -1 && points > 0) {
      encodedPairs.push(points === 1 ? `${index}` : `${index}:${points}`);
    }
  });

  if (encodedPairs.length === 0) return '';

  const data = `v2|${encodedPairs.join(',')}`;
  const base64 = btoa(data);

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Legacy encoder for backward compatibility (Version 1)
 * Encodes unlocked skill IDs into a compact URL parameter using bitset
 */
export function encodeSkillsToUrl(unlockedSkills: Set<string>): string {
  if (unlockedSkills.size === 0) return '';

  // Map skill IDs to their indices in the skillNodes array
  const indices: number[] = [];
  skillNodes.forEach((node, index) => {
    if (unlockedSkills.has(node.id)) {
      indices.push(index);
    }
  });

  // Convert to compact binary representation
  // Use a bitset for maximum compactness
  const bitArray = new Uint8Array(Math.ceil(skillNodes.length / 8));
  indices.forEach(index => {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    bitArray[byteIndex] |= (1 << bitIndex);
  });

  // Convert to base64
  const binary = String.fromCharCode(...bitArray);
  const base64 = btoa(binary);

  // Make URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes URL parameter back into skill points (supports v1, v2, and v3)
 */
export function decodeSkillPointsFromUrl(encoded: string): Record<string, number> {
  if (!encoded) return {};

  try {
    // Check for version 3 format (starts with '3')
    if (encoded.startsWith('3')) {
      return decodeV3Format(encoded);
    }

    // Legacy formats use base64
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    // Decode from base64
    const data = atob(base64);

    // Check if this is v2 format
    if (data.startsWith('v2|')) {
      return decodeV2Format(data);
    } else {
      // Legacy v1 format (bitset)
      return decodeV1Format(data);
    }
  } catch (error) {
    return {};
  }
}

/**
 * Decode version 3 format (ultra-compact binary)
 */
function decodeV3Format(encoded: string): Record<string, number> {
  const skillPoints: Record<string, number> = {};

  let pos = 1; // Skip '3' prefix
  let currentIndex = 0;

  while (pos < encoded.length) {
    // Decode delta with points flag
    const [deltaWithFlag, consumed1] = decodeVarInt(encoded, pos);
    if (consumed1 === 0) break;
    pos += consumed1;

    const hasMultiplePoints = (deltaWithFlag & 1) === 1;
    const delta = deltaWithFlag >> 1;
    currentIndex += delta;

    let points = 1;
    if (hasMultiplePoints) {
      const [pointsMinusTwo, consumed2] = decodeVarInt(encoded, pos);
      if (consumed2 === 0) break;
      pos += consumed2;
      points = pointsMinusTwo + 2;
    }

    if (currentIndex < skillNodes.length) {
      const skillId = skillNodes[currentIndex].id;
      skillPoints[skillId] = points;
    }
  }

  return skillPoints;
}

/**
 * Decode version 2 format (points-based)
 */
function decodeV2Format(data: string): Record<string, number> {
  const skillPoints: Record<string, number> = {};
  const payload = data.substring(3); // Remove "v2|" prefix
  const pairs = payload.split(',');

  pairs.forEach(pair => {
    const [indexStr, pointsStr] = pair.split(':');
    const index = parseInt(indexStr, 10);
    const points = pointsStr ? parseInt(pointsStr, 10) : 1; // Default to 1 if omitted

    if (!isNaN(index) && index < skillNodes.length) {
      const skillId = skillNodes[index].id;
      skillPoints[skillId] = points;
    }
  });

  return skillPoints;
}

/**
 * Decode version 1 format (legacy bitset) - backward compatibility
 */
function decodeV1Format(binary: string): Record<string, number> {
  const skillPoints: Record<string, number> = {};
  const bitArray = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bitArray[i] = binary.charCodeAt(i);
  }

  // Extract indices from bitset
  bitArray.forEach((byte, byteIndex) => {
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if (byte & (1 << bitIndex)) {
        const index = byteIndex * 8 + bitIndex;
        if (index < skillNodes.length) {
          const skillId = skillNodes[index].id;
          skillPoints[skillId] = 1; // Legacy format assumes 1 point
        }
      }
    }
  });

  return skillPoints;
}

/**
 * Legacy decoder for backward compatibility
 * Decodes URL parameter back into skill IDs
 */
export function decodeSkillsFromUrl(encoded: string): string[] {
  const skillPoints = decodeSkillPointsFromUrl(encoded);
  return Object.keys(skillPoints);
}

// Current encoder version
const ENCODER_VERSION = 3;

/**
 * Updates the URL with current skill state without page reload
 * Format: ?v=3&build=...
 */
export function updateUrlWithSkills(skillPoints: Map<string, number>): void {
  const encoded = encodeSkillPointsToUrl(skillPoints);
  const url = new URL(window.location.href);

  if (encoded) {
    // Set version parameter first, then build
    url.searchParams.set('v', String(ENCODER_VERSION));
    url.searchParams.set('build', encoded);
  } else {
    url.searchParams.delete('v');
    url.searchParams.delete('build');
  }

  window.history.replaceState({}, '', url.toString());
}

/**
 * Gets skill points from current URL (supports both v1 and v2 formats)
 */
export function getSkillPointsFromUrl(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  const url = new URL(window.location.href);
  const encoded = url.searchParams.get('build');

  return encoded ? decodeSkillPointsFromUrl(encoded) : {};
}

/**
 * Legacy: Gets skill IDs from current URL (backward compatibility)
 */
export function getSkillsFromUrl(): string[] {
  if (typeof window === 'undefined') return [];

  const url = new URL(window.location.href);
  const encoded = url.searchParams.get('build');

  return encoded ? decodeSkillsFromUrl(encoded) : [];
}

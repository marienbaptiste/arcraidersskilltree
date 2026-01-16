import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SkillNode, TreeType } from '@/types/skills';

type ConfigMode = 'current' | 'proto';

function getConfigPaths(mode: ConfigMode = 'current') {
  // Store configs directly in data/ folder
  if (mode === 'proto') {
    return {
      CONFIG_PATH: path.join(process.cwd(), 'data', 'proto', 'config.json'),
      SKILL_TREE_CONFIG_PATH: path.join(process.cwd(), 'data', 'proto', 'skillTreeConfig.json'),
    };
  }
  return {
    CONFIG_PATH: path.join(process.cwd(), 'data', 'config.json'),
    SKILL_TREE_CONFIG_PATH: path.join(process.cwd(), 'data', 'config', 'skillTreeConfig.json'),
  };
}

interface Config {
  version: string;
  trees: Record<TreeType, { name: string; color: string }>;
  nodeOverrides: Record<string, Partial<SkillNode>>;
}

export async function GET(request: NextRequest) {
  try {
    // Get mode from query parameter (default to 'current')
    const searchParams = request.nextUrl.searchParams;
    const modeParam = searchParams.get('mode');
    // Support both 'proto' and 'main' as mode values
    const mode: ConfigMode = modeParam === 'proto' ? 'proto' : 'current';

    const { CONFIG_PATH, SKILL_TREE_CONFIG_PATH } = getConfigPaths(mode);

    const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config: Config = JSON.parse(configData);

    // Also read maxSkillPoints from skillTreeConfig
    let maxSkillPoints = 76; // default
    try {
      const skillTreeConfigData = await fs.readFile(SKILL_TREE_CONFIG_PATH, 'utf-8');
      const skillTreeConfig = JSON.parse(skillTreeConfigData);
      if (skillTreeConfig.maxSkillPoints !== undefined) {
        maxSkillPoints = skillTreeConfig.maxSkillPoints;
      }
    } catch (e) {
      console.error('Error reading skillTreeConfig for maxSkillPoints:', e);
    }

    return NextResponse.json({ ...config, maxSkillPoints });
  } catch (error) {
    console.error('Error reading config:', error);
    // Return default config
    return NextResponse.json({
      version: '1.0.0',
      trees: {
        A: { name: 'Tree A', color: '#10b981' },
        B: { name: 'Tree B', color: '#22c55e' },
        C: { name: 'Tree C', color: '#22c55e' },
        D: { name: 'Tree D', color: '#22c55e' },
      },
      nodeOverrides: {},
      maxSkillPoints: 76,
    });
  }
}

export async function POST(request: NextRequest) {
  // Disable config saving in production (read-only filesystem on Vercel)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: true,
        message: 'Configuration saving is disabled in production',
      },
      { status: 200 }
    );
  }

  try {
    // Get mode from query parameter (default to 'current')
    const searchParams = request.nextUrl.searchParams;
    const mode = (searchParams.get('mode') as ConfigMode) || 'current';
    const { CONFIG_PATH, SKILL_TREE_CONFIG_PATH } = getConfigPaths(mode);

    const body = await request.json();
    const { trees, nodeOverrides, maxSkillPoints }: {
      trees?: Record<TreeType, { name: string; color: string }>;
      nodeOverrides?: Record<string, Partial<SkillNode>>;
      maxSkillPoints?: number;
    } = body;

    // Handle maxSkillPoints update
    if (maxSkillPoints !== undefined) {
      try {
        const skillTreeConfigData = await fs.readFile(SKILL_TREE_CONFIG_PATH, 'utf-8');
        const skillTreeConfig = JSON.parse(skillTreeConfigData);
        skillTreeConfig.maxSkillPoints = maxSkillPoints;
        await fs.writeFile(SKILL_TREE_CONFIG_PATH, JSON.stringify(skillTreeConfig, null, 2), 'utf-8');

        return NextResponse.json({
          success: true,
          message: 'Max skill points updated successfully',
        });
      } catch (error) {
        console.error('Error updating maxSkillPoints:', error);
        return NextResponse.json(
          { error: 'Failed to update max skill points: ' + (error as Error).message },
          { status: 500 }
        );
      }
    }

    // Read current config
    let config: Config;
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      config = JSON.parse(configData);
    } catch {
      config = {
        version: '1.0.0',
        trees: {
          A: { name: 'Tree A', color: '#10b981' },
          B: { name: 'Tree B', color: '#22c55e' },
          C: { name: 'Tree C', color: '#22c55e' },
          D: { name: 'Tree D', color: '#22c55e' },
        },
        nodeOverrides: {},
      };
    }

    // Update with new data
    if (trees) {
      config.trees = trees;
    }
    if (nodeOverrides) {
      config.nodeOverrides = nodeOverrides;
    }

    const configJson = JSON.stringify(config, null, 2);

    // Ensure directory exists
    const configDir = path.dirname(CONFIG_PATH);
    await fs.mkdir(configDir, { recursive: true });

    // Write to data/ folder
    await fs.writeFile(CONFIG_PATH, configJson, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
      config
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

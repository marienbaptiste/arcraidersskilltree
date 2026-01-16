import { SkillNode, TreeType } from '@/types/skills';

export interface TreeSettings {
  name: string;
  color: string;
  visible: boolean;
}

export interface ExportConfig {
  version: string;
  timestamp: string;
  trees: Record<TreeType, TreeSettings>;
  nodes: SkillNode[];
}

/**
 * Export current configuration to JSON
 */
export function exportConfig(
  nodes: SkillNode[],
  treeSettings: Record<TreeType, TreeSettings>
): ExportConfig {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    trees: treeSettings,
    nodes: nodes,
  };
}

/**
 * Download configuration as JSON file
 */
export function downloadConfigAsJson(config: ExportConfig, filename: string = 'skill-tree-config.json') {
  const jsonString = JSON.stringify(config, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Load configuration from JSON file
 */
export function loadConfigFromJson(file: File): Promise<ExportConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string) as ExportConfig;
        resolve(config);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Copy configuration to clipboard
 */
export async function copyConfigToClipboard(config: ExportConfig): Promise<void> {
  const jsonString = JSON.stringify(config, null, 2);
  await navigator.clipboard.writeText(jsonString);
}

// Helper script to generate wrapped container JSX
const fs = require('fs');
const path = require('path');

// Read the current SkillTree.tsx file
const filePath = path.join(__dirname, '..', 'components', 'SkillTree.tsx');
const content = fs.readFileSync(filePath, 'utf-8');

// Extract container sections and wrap them
const containerPattern = /(\s*){\/\* Tree ([A-D]) container node ([^\*]+) \*\/}\n(\s*)<path\n([\s\S]*?)\n\s*\/>/g;

let match;
const replacements = [];

while ((match = containerPattern.exec(content)) !== null) {
  const [fullMatch, indent, tree, nodeId, pathIndent, pathContent] = match;
  const cleanNodeId = nodeId.trim();
  const skillId = `${tree}-${cleanNodeId}`;

  const wrapped = `${indent}{/* Tree ${tree} container node ${cleanNodeId} */}
${indent}{shouldShowContainer('${skillId}') && (
${indent}  <path
${pathContent}
${indent}  />
${indent})}`;

  replacements.push({
    original: fullMatch,
    wrapped: wrapped
  });
}

console.log(`Found ${replacements.length} containers to wrap`);
console.log('\nFirst replacement example:');
console.log('ORIGINAL:');
console.log(replacements[0]?.original);
console.log('\nWRAPPED:');
console.log(replacements[0]?.wrapped);

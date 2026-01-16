import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const iconsDir = path.join(process.cwd(), 'public', 'icons');
    const files = await fs.readdir(iconsDir);

    // Filter for skill_icon_*.png files and sort numerically
    const iconFiles = files
      .filter(file => file.startsWith('skill_icon_') && file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/skill_icon_(\d+)\.png/)?.[1] || '0');
        const numB = parseInt(b.match(/skill_icon_(\d+)\.png/)?.[1] || '0');
        return numA - numB;
      })
      .map(file => `/icons/${file}`);

    return NextResponse.json({ icons: iconFiles });
  } catch (error) {
    console.error('Error reading icons directory:', error);
    return NextResponse.json({ icons: [] });
  }
}

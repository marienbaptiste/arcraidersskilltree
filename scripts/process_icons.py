#!/usr/bin/env python3
"""
Process all icon images to be 128x128 with consistent padding.
Finds the non-transparent bounding box and centers the content with uniform padding.
"""

from PIL import Image
import numpy as np
import os
import sys

def get_bounding_box(img):
    """Get the bounding box of non-transparent pixels."""
    # Get the alpha channel
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Get the bounding box of non-transparent pixels
    bbox = img.getbbox()
    return bbox

def get_visual_center(img):
    """Calculate the visual center of mass based on non-transparent pixels."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Convert to numpy array
    data = np.array(img)
    alpha = data[:, :, 3]

    # Find all non-transparent pixels
    y_coords, x_coords = np.where(alpha > 0)

    if len(x_coords) == 0:
        return None

    # Weight by alpha values for better center calculation
    weights = alpha[y_coords, x_coords].astype(float)

    # Calculate weighted center
    center_x = np.average(x_coords, weights=weights)
    center_y = np.average(y_coords, weights=weights)

    return (center_x, center_y)

def process_icon(input_path, output_path, target_size=128, padding=16):
    """
    Process an icon to be target_size x target_size with consistent padding.
    Uses visual center of mass for perfect centering.

    Args:
        input_path: Path to input image
        output_path: Path to save processed image
        target_size: Final image size (default 128)
        padding: Padding in pixels from edge to content (default 16)
    """
    # Open the image
    img = Image.open(input_path)

    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Get bounding box of non-transparent content
    bbox = get_bounding_box(img)

    if bbox is None:
        # Image is completely transparent, create blank image
        new_img = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
        new_img.save(output_path, 'PNG')
        return

    # Crop to content
    cropped = img.crop(bbox)

    # Calculate the maximum size the content can be (with padding on all sides)
    max_content_size = target_size - (2 * padding)

    # Calculate scaling factor to fit within max_content_size while maintaining aspect ratio
    width, height = cropped.size
    scale = min(max_content_size / width, max_content_size / height)

    # Calculate new size
    new_width = int(width * scale)
    new_height = int(height * scale)

    # Resize the cropped content
    resized = cropped.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Get the visual center of the resized content
    visual_center = get_visual_center(resized)

    # Create new transparent background of target size
    new_img = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))

    if visual_center:
        # Calculate offset to center the visual mass at the center of target canvas
        center_x, center_y = visual_center
        target_center = target_size / 2

        # Calculate position to place the resized image so its visual center aligns with target center
        x_offset = int(target_center - center_x)
        y_offset = int(target_center - center_y)
    else:
        # Fallback to geometric center if visual center calculation fails
        x_offset = (target_size - new_width) // 2
        y_offset = (target_size - new_height) // 2

    # Paste the resized content onto the calculated position
    new_img.paste(resized, (x_offset, y_offset), resized)

    # Save the result
    new_img.save(output_path, 'PNG')
    print(f"Processed: {os.path.basename(input_path)} -> {new_width}x{new_height} visually centered in {target_size}x{target_size}")

def main():
    # Get the icons directory
    icons_dir = '/Users/baptiste/github/Igaveitashot/skill-tree-planner/public/icons'

    if not os.path.exists(icons_dir):
        print(f"Error: Icons directory not found: {icons_dir}")
        sys.exit(1)

    # Process all PNG files in the icons directory
    png_files = [f for f in os.listdir(icons_dir) if f.endswith('.png')]

    if not png_files:
        print(f"No PNG files found in {icons_dir}")
        sys.exit(1)

    print(f"Found {len(png_files)} icon files to process")
    print(f"Target size: 128x128 with 16px padding\n")

    for filename in sorted(png_files):
        input_path = os.path.join(icons_dir, filename)
        output_path = input_path  # Overwrite the original

        try:
            process_icon(input_path, output_path, target_size=128, padding=16)
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"\nProcessed {len(png_files)} icons successfully!")

if __name__ == '__main__':
    main()

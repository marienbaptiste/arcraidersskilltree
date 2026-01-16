#!/bin/bash

echo "Extracting containers from SVG..."
python "$(dirname "$0")/extractContainers.py" > "$(dirname "$0")/containers_output.txt"

echo ""
echo "Updating SkillTree.tsx with new positions..."
python "$(dirname "$0")/updateContainersByDistance.py"

echo ""
echo "Done!"

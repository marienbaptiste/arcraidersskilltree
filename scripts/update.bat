@echo off
echo Extracting containers from SVG...
python "%~dp0extractContainers.py" > "%~dp0containers_output.txt"

echo.
echo Updating SkillTree.tsx with new positions...
python "%~dp0updateContainersByDistance.py"

echo.
echo Done!
pause

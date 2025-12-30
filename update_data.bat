@echo off
REM Add Node.js to PATH for this session only
SET PATH=C:\Program Files\nodejs;%PATH%

REM Navigate to the web-app directory
cd web-app

REM Run the data processing script
echo Processing Data...
node scripts/processData.js
pause

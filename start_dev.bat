@echo off
REM Add Node.js to PATH for this session only
SET PATH=C:\Program Files\nodejs;%PATH%

REM Navigate to the web-app directory
cd web-app

REM Run the dev server
echo Starting Local Development Server...
npm run dev

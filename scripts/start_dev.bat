@echo off
REM Add Node.js to PATH for this session only
SET PATH=C:\Program Files\nodejs;%PATH%

REM Navigate to the project root (one level up from scripts folder)
cd /d %~dp0..

REM Run the dev server
echo Starting Local Development Server...
npm run dev

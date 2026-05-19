@echo off
cd /d "%~dp0"
title AutaKimi Extensions Release CLI
node scripts\release.mjs
pause

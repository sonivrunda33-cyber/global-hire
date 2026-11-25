@echo off
cd /d "%~dp0"
py app.py
if errorlevel 1 (
  echo.
  echo Could not start GlobalHire. Open this folder in PyCharm, set up a Python 3 interpreter, install requirements.txt, then run app.py.
  pause
)

@echo off
echo ====================================
echo Создание суперпользователя Django
echo ====================================
echo.
cd /d %~dp0
call venv\Scripts\python.exe create_superuser_auto.py
echo.
pause


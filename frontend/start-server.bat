@echo off
echo ====================================
echo Запуск Frontend сервера
echo ====================================
echo.
cd /d %~dp0
echo Текущая директория: %CD%
echo.
echo Проверка зависимостей...
if not exist "node_modules" (
    echo ОШИБКА: node_modules не найден!
    echo Выполните: npm install --legacy-peer-deps
    pause
    exit /b 1
)
echo.
echo Запуск Angular dev сервера...
echo Сервер будет доступен на http://localhost:4200
echo.
echo Для остановки нажмите Ctrl+C
echo.
call npm start


@echo off
echo ====================================
echo Установка Wiki System Frontend
echo ====================================

echo.
echo Шаг 1: Установка зависимостей...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ОШИБКА: Не удалось установить зависимости
    pause
    exit /b 1
)

echo.
echo ====================================
echo Установка завершена успешно!
echo ====================================
echo.
echo Запустите dev сервер: npm start
echo.
pause


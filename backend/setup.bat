@echo off
echo ====================================
echo Установка Wiki System Backend
echo ====================================

echo.
echo Шаг 1: Создание виртуального окружения...
python -m venv venv
if errorlevel 1 (
    echo ОШИБКА: Не удалось создать виртуальное окружение
    pause
    exit /b 1
)

echo.
echo Шаг 2: Активация виртуального окружения...
call venv\Scripts\activate.bat

echo.
echo Шаг 3: Установка зависимостей...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ОШИБКА: Не удалось установить зависимости
    pause
    exit /b 1
)

echo.
echo Шаг 4: Создание миграций...
python manage.py makemigrations
if errorlevel 1 (
    echo ОШИБКА: Не удалось создать миграции
    pause
    exit /b 1
)

echo.
echo Шаг 5: Применение миграций...
python manage.py migrate
if errorlevel 1 (
    echo ОШИБКА: Не удалось применить миграции
    pause
    exit /b 1
)

echo.
echo Шаг 6: Создание директории для медиа файлов...
if not exist "media\articles\images" mkdir "media\articles\images"

echo.
echo ====================================
echo Установка завершена успешно!
echo ====================================
echo.
echo Следующие шаги:
echo 1. Создайте суперпользователя: python manage.py createsuperuser
echo 2. Запустите сервер: python manage.py runserver
echo.
pause


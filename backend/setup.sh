#!/bin/bash

echo "===================================="
echo "Установка Wiki System Backend"
echo "===================================="

echo ""
echo "Шаг 1: Создание виртуального окружения..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "ОШИБКА: Не удалось создать виртуальное окружение"
    exit 1
fi

echo ""
echo "Шаг 2: Активация виртуального окружения..."
source venv/bin/activate

echo ""
echo "Шаг 3: Установка зависимостей..."
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ОШИБКА: Не удалось установить зависимости"
    exit 1
fi

echo ""
echo "Шаг 4: Создание миграций..."
python manage.py makemigrations
if [ $? -ne 0 ]; then
    echo "ОШИБКА: Не удалось создать миграции"
    exit 1
fi

echo ""
echo "Шаг 5: Применение миграций..."
python manage.py migrate
if [ $? -ne 0 ]; then
    echo "ОШИБКА: Не удалось применить миграции"
    exit 1
fi

echo ""
echo "Шаг 6: Создание директории для медиа файлов..."
mkdir -p media/articles/images

echo ""
echo "===================================="
echo "Установка завершена успешно!"
echo "===================================="
echo ""
echo "Следующие шаги:"
echo "1. Создайте суперпользователя: python manage.py createsuperuser"
echo "2. Запустите сервер: python manage.py runserver"
echo ""


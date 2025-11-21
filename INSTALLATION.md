# Инструкция по установке и запуску

## Требования

- Python 3.10+
- Node.js 18+
- npm или yarn

## Установка Backend (Django)

1. Перейдите в директорию backend:
```bash
cd backend
```

2. Создайте виртуальное окружение:
```bash
python -m venv venv
```

3. Активируйте виртуальное окружение:
   - Windows:
   ```bash
   venv\Scripts\activate
   ```
   - Linux/Mac:
   ```bash
   source venv/bin/activate
   ```

4. Установите зависимости:
```bash
pip install -r requirements.txt
```

5. Выполните миграции:
```bash
python manage.py migrate
```

6. Создайте суперпользователя (опционально):
```bash
python manage.py createsuperuser
```

7. Запустите сервер:
```bash
python manage.py runserver
```

Backend будет доступен по адресу: http://localhost:8000

## Установка Frontend (Angular)

1. Перейдите в директорию frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install --legacy-peer-deps
```

**Примечание:** Используется флаг `--legacy-peer-deps` для совместимости ngx-quill с Angular 20. Файл `.npmrc` уже настроен для автоматического использования этого флага.

3. Запустите dev сервер:
```bash
npm start
```

Frontend будет доступен по адресу: http://localhost:4200

## Первый запуск

1. Запустите backend (Django)
2. Запустите frontend (Angular)
3. Откройте браузер и перейдите на http://localhost:4200
4. Зарегистрируйте нового пользователя или войдите, если создали суперпользователя

## Доступ к Django Admin

1. Откройте http://localhost:8000/admin
2. Войдите с учетными данными суперпользователя
3. Здесь вы можете управлять статьями, версиями, пользователями и правами доступа

## Структура базы данных

База данных SQLite создается автоматически в `backend/db.sqlite3` при первом запуске миграций.

## Загрузка изображений

Изображения сохраняются в `backend/media/articles/images/`. Убедитесь, что директория существует и доступна для записи.


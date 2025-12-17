# Mikron Wiki

Система вики с возможностью редактирования статей, управления правами доступа и версионированием.

## Технологии

- **Backend**: Django 5.0 + Django REST Framework
- **Frontend**: Angular v20
- **База данных**: SQLite (файловая БД)
- **Аутентификация**: JWT токены

## Возможности

- ✅ Редактирование статей с поддержкой изображений и таблиц (GrapesJS редактор)
- ✅ Импорт содержимого из Word документов (Pandoc + mammoth)
- ✅ Система прав доступа через группы пользователей
- ✅ Версионирование статей с возможностью восстановления
- ✅ Django Admin для управления контентом
- ✅ REST API для фронтенда

## Установка и запуск

### Вариант 1: Docker Compose (рекомендуется)

Самый простой способ запуска проекта:

```bash
# Development режим
docker-compose up -d

# Production режим
docker-compose -f docker-compose.prod.yml up -d
```

Подробная документация по Docker: [DOCKER.md](./DOCKER.md)

### Вариант 2: Локальная установка

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### Frontend

```bash
cd frontend
npm install
ng serve
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register/` - Регистрация
- `POST /api/auth/login/` - Вход
- `GET /api/auth/me/` - Текущий пользователь
- `POST /api/auth/refresh/` - Обновление токена

### Статьи
- `GET /api/articles/` - Список статей
- `POST /api/articles/` - Создание статьи
- `GET /api/articles/{id}/` - Детали статьи
- `PUT /api/articles/{id}/` - Обновление статьи
- `DELETE /api/articles/{id}/` - Удаление статьи
- `GET /api/articles/{id}/versions/` - Версии статьи
- `POST /api/articles/{id}/restore_version/` - Восстановление версии
- `POST /api/articles/{id}/upload_image/` - Загрузка изображения
- `POST /api/articles/import_word/` - Импорт из Word

## Структура проекта

```
wiki/
├── backend/          # Django проект
│   ├── articles/     # Приложение статей
│   ├── users/        # Приложение пользователей
│   └── wiki_backend/ # Настройки проекта
├── frontend/         # Angular проект
└── docs/             # Документация
```

## Документация

- [Инструкция по установке](./INSTALLATION.md)
- [Docker и Docker Compose](./DOCKER.md)
- [Итоговое описание проекта](./PROJECT_SUMMARY.md)
- [Требования к функционалу](./docs/requirements/)
- [API документация](./docs/api/api.md)


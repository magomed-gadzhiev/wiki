# Docker и Docker Compose

Данный проект поддерживает запуск через Docker и Docker Compose для упрощения развертывания и разработки.

## Структура файлов

- `docker-compose.yml` - конфигурация для development режима
- `docker-compose.prod.yml` - конфигурация для production режима
- `backend/Dockerfile` - образ для backend (Django)
- `frontend/Dockerfile` - образ для frontend (production, nginx)
- `frontend/Dockerfile.dev` - образ для frontend (development, ng serve)
- `backend/docker-entrypoint.sh` - скрипт инициализации backend

## Быстрый старт

### Development режим

1. Скопируйте файл с переменными окружения (опционально):
```bash
cp .env.example .env
```

2. Запустите все сервисы:
```bash
docker-compose up -d
```

3. Проверьте статус сервисов:
```bash
docker-compose ps
```

4. Просмотрите логи:
```bash
docker-compose logs -f
```

### Production режим

1. Создайте файл `.env` с production настройками:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
POSTGRES_PASSWORD=strong-password-here
DJANGO_SUPERUSER_PASSWORD=strong-password-here
```

2. Запустите в production режиме:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Переменные окружения

### База данных PostgreSQL
- `POSTGRES_DB` - имя базы данных (по умолчанию: `wiki`)
- `POSTGRES_USER` - пользователь БД (по умолчанию: `postgres`)
- `POSTGRES_PASSWORD` - пароль БД (по умолчанию: `postgres`)
- `POSTGRES_PORT` - порт БД (по умолчанию: `5432`)

### Django Backend
- `SECRET_KEY` - секретный ключ Django (обязательно для production)
- `DEBUG` - режим отладки (по умолчанию: `True`)
- `BACKEND_PORT` - порт backend (по умолчанию: `8000`)
- `DB_ENGINE` - движок БД (по умолчанию: `django.db.backends.postgresql`)
- `DB_NAME` - имя БД (по умолчанию: `wiki`)
- `DB_USER` - пользователь БД (по умолчанию: `postgres`)
- `DB_PASSWORD` - пароль БД (по умолчанию: `postgres`)
- `DB_HOST` - хост БД (по умолчанию: `db` в Docker, `127.0.0.1` локально)
- `DB_PORT` - порт БД (по умолчанию: `5432`)

### Django Superuser
- `DJANGO_SUPERUSER_USERNAME` - имя суперпользователя (по умолчанию: `admin`)
- `DJANGO_SUPERUSER_EMAIL` - email суперпользователя (по умолчанию: `admin@example.com`)
- `DJANGO_SUPERUSER_PASSWORD` - пароль суперпользователя (по умолчанию: `admin`)

### Frontend
- `FRONTEND_PORT` - порт frontend (по умолчанию: `4200` для dev, `80` для prod)
- `FRONTEND_DOCKERFILE` - Dockerfile для frontend (по умолчанию: `Dockerfile.dev`)
- `NODE_ENV` - окружение Node.js (по умолчанию: `development`)

## Доступ к сервисам

После запуска сервисы будут доступны по следующим адресам:

- **Frontend**: http://localhost:4200 (development) или http://localhost (production)
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin
- **PostgreSQL**: localhost:5432

## Управление контейнерами

### Остановка сервисов
```bash
docker-compose down
```

### Остановка с удалением volumes (удалит данные БД!)
```bash
docker-compose down -v
```

### Пересборка образов
```bash
docker-compose build
```

### Пересборка без кэша
```bash
docker-compose build --no-cache
```

### Просмотр логов конкретного сервиса
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Выполнение команд в контейнере
```bash
# Backend
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py shell

# Frontend
docker-compose exec frontend npm install
```

## Volumes

Проект использует следующие volumes:

- `postgres_data` - данные PostgreSQL
- `backend_media` - медиа файлы backend (изображения, вложения)
- `backend_static` - статические файлы Django

## Особенности

### Development режим
- Frontend запускается через `ng serve` с hot-reload
- Backend запускается через `runserver` с автоперезагрузкой
- Код монтируется как volume для быстрого обновления
- Автоматическое создание суперпользователя при первом запуске

### Production режим
- Frontend собирается в статические файлы и раздается через nginx
- Backend запускается через gunicorn с 4 воркерами
- Код копируется в образ (не монтируется)
- Требуется установка SECRET_KEY и сильных паролей

## Миграции базы данных

Миграции применяются автоматически при запуске контейнера backend через `docker-entrypoint.sh`.

Для ручного применения миграций:
```bash
docker-compose exec backend python manage.py migrate
```

## Создание суперпользователя

Суперпользователь создается автоматически при первом запуске, если его еще нет.

Для ручного создания:
```bash
docker-compose exec backend python manage.py createsuperuser
```

## Troubleshooting

### Проблемы с подключением к БД
Убедитесь, что контейнер `db` запущен и здоров:
```bash
docker-compose ps
docker-compose logs db
```

### Проблемы с правами доступа
Убедитесь, что volumes имеют правильные права доступа. В Linux может потребоваться:
```bash
sudo chown -R $USER:$USER backend/media backend/staticfiles
```

### Очистка и пересборка
Если возникли проблемы, попробуйте полную пересборку:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```


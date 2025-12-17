# Быстрый старт с Docker

## Предварительные требования

- Docker Desktop (Windows/Mac) или Docker + Docker Compose (Linux)
- Минимум 4GB свободной RAM

## Запуск проекта

### 1. Клонирование репозитория (если еще не сделано)

```bash
git clone <repository-url>
cd wiki
```

### 2. Запуск в development режиме

```bash
docker-compose up -d
```

Эта команда:
- Создаст и запустит контейнеры PostgreSQL, Backend и Frontend
- Применит миграции базы данных
- Создаст суперпользователя (admin/admin)
- Запустит все сервисы

### 3. Проверка статуса

```bash
docker-compose ps
```

Все сервисы должны быть в статусе "Up".

### 4. Доступ к приложению

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin
  - Логин: `admin`
  - Пароль: `admin`

### 5. Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

## Остановка проекта

```bash
docker-compose down
```

Для полной очистки (включая данные БД):
```bash
docker-compose down -v
```

## Production режим

Для production используйте отдельный файл:

```bash
# Создайте .env файл с production настройками
cp env.example.txt .env
# Отредактируйте .env и установите SECRET_KEY и сильные пароли

# Запуск в production режиме
docker-compose -f docker-compose.prod.yml up -d
```

## Полезные команды

### Выполнение команд в контейнере

```bash
# Применить миграции
docker-compose exec backend python manage.py migrate

# Создать суперпользователя
docker-compose exec backend python manage.py createsuperuser

# Открыть Django shell
docker-compose exec backend python manage.py shell

# Установить зависимости frontend
docker-compose exec frontend npm install
```

### Пересборка образов

```bash
# Пересборка всех образов
docker-compose build

# Пересборка конкретного сервиса
docker-compose build backend

# Пересборка без кэша
docker-compose build --no-cache
```

## Troubleshooting

### Проблемы с портами

Если порты 4200, 8000 или 5432 уже заняты, измените их в `.env` файле или `docker-compose.yml`:

```yaml
ports:
  - "4201:4200"  # Измените первый номер на свободный порт
```

### Проблемы с правами доступа (Linux)

```bash
sudo chown -R $USER:$USER backend/media backend/staticfiles
```

### Очистка и перезапуск

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Дополнительная документация

Подробная документация: [DOCKER.md](./DOCKER.md)


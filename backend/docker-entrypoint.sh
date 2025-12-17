#!/bin/bash
set -e

# Ожидание готовности PostgreSQL (если используется)
if [ "${DB_ENGINE:-django.db.backends.postgresql}" = "django.db.backends.postgresql" ]; then
    echo "Waiting for PostgreSQL..."
    DB_HOST=${DB_HOST:-db}
    DB_PORT=${DB_PORT:-5432}
    while ! nc -z $DB_HOST $DB_PORT; do
        sleep 0.1
    done
    echo "PostgreSQL started"
fi

# Применение миграций
echo "Applying migrations..."
python manage.py migrate --noinput

# Сборка статических файлов
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Создание суперпользователя (если не существует)
echo "Checking for superuser..."
python manage.py shell << EOF
from users.models import User
if not User.objects.filter(is_superuser=True).exists():
    print("Creating superuser...")
    User.objects.create_superuser(
        username='${DJANGO_SUPERUSER_USERNAME:-admin}',
        email='${DJANGO_SUPERUSER_EMAIL:-admin@example.com}',
        password='${DJANGO_SUPERUSER_PASSWORD:-admin}'
    )
    print("Superuser created!")
else:
    print("Superuser already exists")
EOF

# Выполнение команды
exec "$@"


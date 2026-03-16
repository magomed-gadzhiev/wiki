FROM python:3.11-slim

# Установка системных зависимостей (build-essential для сборки gssapi из исходников)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    pandoc \
    netcat-openbsd \
    krb5-user \
    libkrb5-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Установка рабочей директории
WORKDIR /app

# Копирование requirements и установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директорий для media и static файлов
RUN mkdir -p /app/media /app/staticfiles

# Открытие порта
EXPOSE 8000

# Скрипт запуска
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


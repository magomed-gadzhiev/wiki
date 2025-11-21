# 🚀 Быстрый запуск Mikron Wiki

## Запуск Backend

```bash
cd backend
.\venv\Scripts\python.exe manage.py runserver
```

**Адрес:** http://localhost:8000

## Запуск Frontend

В новом терминале:

```bash
cd frontend
npm start
```

**Адрес:** http://localhost:4200

## Первый вход

1. Откройте http://localhost:4200
2. Нажмите "Вход" или "Зарегистрироваться"
3. Создайте аккаунт или войдите

## Создание суперпользователя (для доступа к Admin)

В новом терминале:

```bash
cd backend
.\venv\Scripts\python.exe manage.py createsuperuser
```

Затем откройте http://localhost:8000/admin

## Готово! 🎉

Теперь вы можете:
- Создавать статьи
- Редактировать контент
- Загружать изображения
- Импортировать из Word
- Управлять правами доступа


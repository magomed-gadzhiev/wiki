# Данные для входа в Django Admin

## Суперпользователь уже создан!

### Учетные данные:

- **Username:** `admin`
- **Password:** `admin123` (или тот, который вы указали ранее)
- **Email:** `admin@wiki.local`

### Доступ к Django Admin:

**URL:** http://localhost:8000/admin

### Что делать:

1. Убедитесь, что Django сервер запущен:
   ```bash
   cd backend
   .\venv\Scripts\python.exe manage.py runserver
   ```

2. Откройте в браузере: http://localhost:8000/admin

3. Войдите с указанными выше данными

4. **ВАЖНО:** После первого входа рекомендуется изменить пароль!

### Изменение пароля:

1. Войдите в Django Admin
2. Перейдите в раздел "Users"
3. Найдите пользователя "admin"
4. Нажмите на него и измените пароль

### Создание нового суперпользователя:

Если нужно создать другого пользователя, используйте:

```bash
cd backend
.\venv\Scripts\python.exe create_superuser_auto.py
```

Или отредактируйте файл `create_superuser_auto.py` и измените параметры.


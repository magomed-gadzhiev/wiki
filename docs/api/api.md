# API Документация

## Базовый URL
```
http://localhost:8000/api
```

## Аутентификация

Все запросы (кроме регистрации и входа) требуют JWT токен в заголовке:
```
Authorization: Bearer <access_token>
```

## Endpoints

### Аутентификация

#### POST /auth/register/
Регистрация нового пользователя

**Тело запроса:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string (optional)",
  "first_name": "string (optional)",
  "last_name": "string (optional)"
}
```

**Ответ:**
```json
{
  "user": {
    "id": 1,
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string"
  },
  "tokens": {
    "access": "string",
    "refresh": "string"
  }
}
```

#### POST /auth/login/
Вход пользователя

**Тело запроса:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Ответ:** аналогичен регистрации

#### GET /auth/me/
Получить информацию о текущем пользователе

#### POST /auth/refresh/
Обновить access token

**Тело запроса:**
```json
{
  "refresh": "string"
}
```

#### GET /auth/users/
Получить список пользователей (для управления правами доступа)

**Query параметры:**
- `search` - поиск по username, email, имени, фамилии

**Ответ:**
```json
[
  {
    "id": 1,
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string"
  }
]
```

### Статьи

#### GET /articles/
Список статей

**Query параметры:**
- `search` - поиск по тексту
- `author` - фильтр по автору (ID)
- `is_published` - фильтр по статусу публикации (true/false)
- `page` - номер страницы

**Ответ:**
```json
{
  "count": 10,
  "results": [
    {
      "id": "uuid",
      "title": "string",
      "slug": "string",
      "summary": "string",
      "author": {...},
      "created_at": "datetime",
      "updated_at": "datetime",
      "is_published": true,
      "view_count": 0
    }
  ]
}
```

#### POST /articles/
Создание статьи

**Тело запроса:**
```json
{
  "title": "string",
  "summary": "string",
  "content": "string (HTML)",
  "is_published": false,
  "can_view_ids": [1, 2],
  "can_edit_ids": [1],
  "can_delete_ids": [1]
}
```

#### GET /articles/{id}/
Детали статьи

#### PUT /articles/{id}/
Обновление статьи

#### DELETE /articles/{id}/
Удаление статьи

#### GET /articles/{id}/versions/
Список версий статьи

#### POST /articles/{id}/restore_version/
Восстановление версии

**Тело запроса:**
```json
{
  "version_id": "uuid"
}
```

#### POST /articles/{id}/upload_image/
Загрузка изображения

**Form Data:**
- `image` - файл изображения
- `alt_text` - альтернативный текст (optional)

#### POST /articles/import_word/
Импорт из Word документа

**Form Data:**
- `file` - .doc или .docx файл

**Ответ:**
```json
{
  "content": "string (HTML)",
  "warnings": []
}
```


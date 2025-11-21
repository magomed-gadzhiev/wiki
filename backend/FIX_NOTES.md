# Исправления API

## Исправлена ошибка с полем change_description

**Проблема:** 
При создании статьи через API возникала ошибка:
```
Field name `change_description` is not valid for model `Article`.
```

**Причина:**
Поле `change_description` было добавлено в сериализатор `ArticleSerializer`, но это поле не существует в модели `Article`. Оно существует только в модели `ArticleVersion`.

**Решение:**
1. Удалено поле `change_description` из списка полей в `ArticleSerializer`
2. В методе `perform_update` значение `change_description` теперь берется напрямую из `request.data` при создании версии

**Файлы изменены:**
- `backend/articles/serializers.py` - удалено поле из fields
- `backend/articles/views.py` - изменен метод perform_update для получения change_description из request.data

**Как использовать:**
При обновлении статьи можно передать `change_description` в теле запроса, и оно будет использовано при создании новой версии:

```json
{
  "title": "Название",
  "content": "Содержимое",
  "change_description": "Описание изменений"
}
```

Поле `change_description` опционально. Если не указано, будет использовано значение по умолчанию "Обновление статьи".












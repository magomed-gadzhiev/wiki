# Kerberos конфигурация

Эта директория содержит конфигурационные файлы и скрипты для работы с Kerberos SSO.

## Файлы

- `krb5.conf.example` - Пример конфигурации Kerberos клиента
- `setup-keytab.sh` - Скрипт для создания keytab файла
- `http.keytab` - Keytab файл для Apache (создается скриптом, не должен попадать в git)

## Создание keytab файла

### Автоматически (Linux/Mac)

```bash
./kerberos/setup-keytab.sh
```

### Вручную

```bash
# Создать сервисный principal
docker exec -it wiki_kerberos kadmin.local -q "addprinc -randkey HTTP/localhost@EXAMPLE.COM"

# Создать keytab файл
docker exec -it wiki_kerberos kadmin.local -q "ktadd -k /tmp/http.keytab HTTP/localhost@EXAMPLE.COM"

# Скопировать из контейнера
docker cp wiki_kerberos:/tmp/http.keytab ./kerberos/http.keytab

# Установить права доступа
chmod 644 ./kerberos/http.keytab
```

## Важно

- **Keytab файл содержит секретные ключи** и не должен попадать в систему контроля версий
- Файл `http.keytab` должен существовать перед запуском Apache контейнера
- Если keytab файл отсутствует, Apache контейнер не сможет запуститься


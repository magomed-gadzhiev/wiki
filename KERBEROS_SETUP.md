# Быстрая настройка Kerberos SSO

## Шаг 1: Запуск сервисов

```bash
docker-compose up -d
```

## Шаг 2: Создание пользователя и keytab

```bash
# Создать тестового пользователя
docker exec -it wiki_kerberos kadmin.local -q "addprinc -pw testpass testuser@EXAMPLE.COM"

# Создать keytab файл для Apache
docker exec -it wiki_kerberos kadmin.local -q "addprinc -randkey HTTP/localhost@EXAMPLE.COM"
docker exec -it wiki_kerberos kadmin.local -q "ktadd -k /tmp/http.keytab HTTP/localhost@EXAMPLE.COM"
docker cp wiki_kerberos:/tmp/http.keytab ./kerberos/http.keytab

# На Linux/Mac установите права доступа
chmod 644 ./kerberos/http.keytab
```

## Шаг 3: Перезапуск Apache

```bash
docker-compose restart apache
```

## Шаг 4: Настройка клиента

Создайте файл `/etc/krb5.conf` (Linux/Mac) или `C:\Windows\krb5.ini` (Windows):

```ini
[libdefaults]
    default_realm = EXAMPLE.COM
    dns_lookup_realm = false
    dns_lookup_kdc = false

[realms]
    EXAMPLE.COM = {
        kdc = localhost:88
        admin_server = localhost:749
    }
```

## Шаг 5: Получение билета Kerberos

```bash
kinit testuser@EXAMPLE.COM
# Пароль: testpass
```

## Шаг 6: Тестирование SSO

Откройте браузер и перейдите на:
```
http://localhost:8080/api/auth/kerberos-check/
```

Браузер автоматически выполнит SSO аутентификацию!

## Порты

- **Apache (SSO)**: `http://localhost:8080` - используйте для полноценного SSO
- **Django (прямой доступ)**: `http://localhost:8000` - для разработки без SSO
- **Frontend**: `http://localhost:4200` - Angular приложение

## Подробная документация

См. [docs/requirements/kerberos-sso.md](./docs/requirements/kerberos-sso.md)


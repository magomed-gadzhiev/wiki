# Интеграция Kerberos SSO для тестирования

## Описание

Проект поддерживает аутентификацию через Kerberos SSO для тестирования единого входа. Интеграция использует Docker-образ `staticmukesh/kerberos-docker` для развертывания тестового Kerberos KDC сервера.

## Архитектура

- **Kerberos KDC**: Контейнер `wiki_kerberos` на основе `staticmukesh/kerberos-docker`
- **Apache с mod_auth_gssapi**: Reverse proxy для обработки Kerberos SPNEGO аутентификации (порт 8080)
- **Django Backend**: Поддержка Kerberos через кастомный backend (`users.kerberos_auth.KerberosBackend`)
- **Middleware**: Автоматическая аутентификация через `KerberosAuthenticationMiddleware`
- **Frontend**: Автоматическая проверка Kerberos при загрузке приложения

## Настройка

### 1. Переменные окружения

В `docker-compose.yml` можно настроить следующие переменные для Kerberos:

```yaml
KRB5_REALM=EXAMPLE.COM          # Realm для Kerberos
KRB5_DOMAIN=example.com         # Домен
KRB5_MASTER_KEY=MASTERKEY       # Мастер-ключ
KRB5_ADMIN_PASS=admin           # Пароль администратора
```

### 2. Запуск сервисов

```bash
docker-compose up -d
```

### 3. Создание тестовых пользователей и keytab файла

#### 3.1. Создание тестового пользователя

```bash
docker exec -it wiki_kerberos kadmin.local -q "addprinc -pw testpass testuser@EXAMPLE.COM"
```

#### 3.2. Создание keytab файла для Apache

Для полноценного SSO необходимо создать keytab файл с сервисным principal:

```bash
# Создать сервисный principal и keytab файл
docker exec -it wiki_kerberos kadmin.local -q "addprinc -randkey HTTP/localhost@EXAMPLE.COM"
docker exec -it wiki_kerberos kadmin.local -q "ktadd -k /tmp/http.keytab HTTP/localhost@EXAMPLE.COM"

# Скопировать keytab из контейнера
docker cp wiki_kerberos:/tmp/http.keytab ./kerberos/http.keytab

# Установить правильные права доступа (Linux/Mac)
chmod 644 ./kerberos/http.keytab
```

**Альтернативный способ** - использовать скрипт `kerberos/setup-keytab.sh`:

```bash
# На Linux/Mac
./kerberos/setup-keytab.sh

# На Windows (в Git Bash или WSL)
bash kerberos/setup-keytab.sh
```

**Важно**: Убедитесь, что файл `kerberos/http.keytab` существует перед запуском Apache, иначе контейнер не запустится.

### 4. Настройка клиента для тестирования

#### Linux/Mac

Создайте файл `/etc/krb5.conf`:

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

[domain_realm]
    .example.com = EXAMPLE.COM
    example.com = EXAMPLE.COM
```

#### Windows

Настройте через `ksetup.exe` или создайте файл `C:\Windows\krb5.ini` аналогично Linux конфигурации.

## Использование

### Полноценное SSO через Apache

После настройки Apache с keytab файлом, SSO работает автоматически:

1. **Настройте клиент** (см. раздел "Настройка клиента для тестирования")
2. **Получите Kerberos билет**:
   ```bash
   kinit testuser@EXAMPLE.COM
   # Введите пароль: testpass
   ```
3. **Откройте браузер** и перейдите на `http://localhost:8080/api/auth/kerberos-check/`
4. Браузер автоматически отправит SPNEGO токен, Apache проверит его через keytab и передаст `REMOTE_USER` в Django
5. Django автоматически создаст пользователя (если его нет) и вернет JWT токены

### API Endpoint

**GET /api/auth/kerberos-check/**

Проверяет наличие Kerberos аутентификации через заголовок `REMOTE_USER`.

**Доступ через Apache (SSO):**
```
http://localhost:8080/api/auth/kerberos-check/
```

**Прямой доступ к Django (без SSO):**
```
http://localhost:8000/api/auth/kerberos-check/
```

**Ответ при успешной аутентификации:**
```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "testuser@example.com",
    ...
  },
  "tokens": {
    "refresh": "...",
    "access": "..."
  },
  "kerberos": true
}
```

**Ответ если Kerberos недоступен:**
```json
{
  "kerberos": false,
  "message": "Kerberos authentication not available. REMOTE_USER header not found."
}
```

### Автоматическая аутентификация

Frontend автоматически проверяет наличие Kerberos при загрузке приложения. Если пользователь аутентифицирован через Kerberos, он автоматически получает JWT токены и входит в систему.

**Важно**: Для полноценного SSO настройте frontend на использование Apache (`http://localhost:8080`) вместо прямого доступа к Django.

### Ручная проверка

Для тестирования можно использовать curl с заголовком `REMOTE_USER`:

```bash
# Прямой доступ к Django (без SSO)
curl -H "REMOTE_USER: testuser@EXAMPLE.COM" http://localhost:8000/api/auth/kerberos-check/

# Через Apache (требует SPNEGO токен)
curl --negotiate -u : http://localhost:8080/api/auth/kerberos-check/
```

## Архитектура SSO

Проект использует **Apache с mod_auth_gssapi** как reverse proxy перед Django для обработки Kerberos SPNEGO аутентификации:

1. **Клиент** (браузер) отправляет SPNEGO токен в запросе
2. **Apache** проверяет токен через keytab файл и извлекает имя пользователя
3. **Apache** передает `REMOTE_USER` заголовок в Django backend
4. **Django middleware** автоматически аутентифицирует пользователя
5. **Django** возвращает JWT токены для дальнейшей работы

### Конфигурация Apache

Apache настроен в `apache/httpd-kerberos.conf`:

```apache
<Location /api>
    AuthType GSSAPI
    AuthName "Kerberos Login"
    GssapiCredStore keytab:/etc/krb5/http.keytab
    GssapiLocalName On
    Require valid-user
    RequestHeader set REMOTE_USER %{REMOTE_USER}s env=REMOTE_USER
</Location>
```

### Порты

- **Apache (SSO)**: `http://localhost:8080` - используйте для полноценного SSO
- **Django (прямой доступ)**: `http://localhost:8000` - для разработки без SSO
- **Frontend**: `http://localhost:4200` - Angular приложение

## Логика работы

### Полноценное SSO (через Apache)

1. **Браузер** отправляет SPNEGO токен в HTTP заголовке `Authorization: Negotiate ...`
2. **Apache** проверяет токен через keytab файл и извлекает имя пользователя из Kerberos principal
3. **Apache** устанавливает заголовок `REMOTE_USER` с именем пользователя и проксирует запрос в Django
4. **Middleware**: `KerberosAuthenticationMiddleware` проверяет заголовок `REMOTE_USER` и автоматически аутентифицирует пользователя
5. **Backend**: `KerberosBackend` создает пользователя в Django, если его еще нет
6. **JWT токены**: После успешной Kerberos аутентификации пользователь получает JWT токены для дальнейшей работы с API
7. **Frontend**: Автоматически получает токены и входит в систему

### Fallback режим

Если Kerberos недоступен или пользователь обращается напрямую к Django (порт 8000), используется стандартная аутентификация по username/password.

## Отладка

### Проверка работы Kerberos KDC

```bash
# Проверить статус контейнера
docker ps | grep kerberos

# Просмотреть логи
docker logs wiki_kerberos

# Проверить доступность портов
telnet localhost 88
```

### Проверка аутентификации

```bash
# Получить билет Kerberos
kinit testuser@EXAMPLE.COM

# Проверить билет
klist

# Проверить подключение к KDC
telnet localhost 88
```

### Логи Django

В логах Django будут отображаться сообщения о Kerberos аутентификации:

```
INFO: Found REMOTE_USER header: testuser@EXAMPLE.COM
INFO: User testuser authenticated via Kerberos middleware
```

## Быстрый старт для тестирования SSO

1. **Запустите сервисы**:
   ```bash
   docker-compose up -d
   ```

2. **Создайте пользователя и keytab**:
   ```bash
   # Создать пользователя
   docker exec -it wiki_kerberos kadmin.local -q "addprinc -pw testpass testuser@EXAMPLE.COM"
   
   # Создать keytab
   docker exec -it wiki_kerberos kadmin.local -q "addprinc -randkey HTTP/localhost@EXAMPLE.COM"
   docker exec -it wiki_kerberos kadmin.local -q "ktadd -k /tmp/http.keytab HTTP/localhost@EXAMPLE.COM"
   docker cp wiki_kerberos:/tmp/http.keytab ./kerberos/http.keytab
   ```

3. **Настройте клиент** (создайте `/etc/krb5.conf` или `C:\Windows\krb5.ini`):
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

4. **Получите билет Kerberos**:
   ```bash
   kinit testuser@EXAMPLE.COM
   # Пароль: testpass
   ```

5. **Откройте браузер** и перейдите на `http://localhost:8080/api/auth/kerberos-check/`

6. Браузер автоматически выполнит SSO аутентификацию!

## Ограничения

1. **Тестовая среда**: Текущая реализация предназначена для тестирования, не для production
2. **Keytab файл**: Должен быть создан до запуска Apache контейнера
3. **Windows**: Для Windows может потребоваться дополнительная настройка через `requests-negotiate-sspi`
4. **Браузеры**: Некоторые браузеры требуют настройки для работы с SPNEGO (особенно Chrome на Windows)

## Ссылки

- [staticmukesh/kerberos-docker](https://github.com/staticmukesh/kerberos-docker)
- [Django Authentication Backends](https://docs.djangoproject.com/en/5.0/topics/auth/customizing/#authentication-backends)
- [Kerberos Protocol](https://web.mit.edu/kerberos/)


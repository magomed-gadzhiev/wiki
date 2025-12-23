#!/bin/bash
# Скрипт для создания keytab файла для Apache

set -e

REALM=${KRB5_REALM:-EXAMPLE.COM}
SERVICE_NAME=${KRB5_SERVICE_NAME:-HTTP/localhost}
KEYTAB_PATH=${KEYTAB_PATH:-/tmp/http.keytab}

echo "Creating Kerberos service principal: ${SERVICE_NAME}@${REALM}"
echo "Keytab will be saved to: ${KEYTAB_PATH}"

# Создаем сервисный principal с случайным ключом
docker exec -i wiki_kerberos kadmin.local <<EOF
addprinc -randkey ${SERVICE_NAME}@${REALM}
ktadd -k ${KEYTAB_PATH} ${SERVICE_NAME}@${REALM}
quit
EOF

# Копируем keytab из контейнера
docker cp wiki_kerberos:${KEYTAB_PATH} ./kerberos/http.keytab

echo "Keytab file created successfully: ./kerberos/http.keytab"
echo "Make sure to set proper permissions: chmod 644 ./kerberos/http.keytab"


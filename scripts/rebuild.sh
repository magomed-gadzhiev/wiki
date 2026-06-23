#!/usr/bin/env bash
#
# Пересборка и перезапуск сервисов Mikron Wiki на Linux.
#
# Скрипт пересобирает Docker-образы и перезапускает контейнеры через
# docker compose. По умолчанию используется dev-конфигурация
# (docker-compose.yml). Можно пересобрать как все сервисы, так и
# отдельные (например, только backend или frontend).
#
# Примеры:
#   ./scripts/rebuild.sh                  # пересобрать и перезапустить все сервисы (dev)
#   ./scripts/rebuild.sh backend          # только backend
#   ./scripts/rebuild.sh backend frontend # backend и frontend
#   ./scripts/rebuild.sh -p               # все сервисы в prod-конфигурации
#   ./scripts/rebuild.sh -p -c frontend   # frontend в prod, без кэша
#
set -euo pipefail

# Каталог проекта (на уровень выше каталога scripts), чтобы скрипт
# можно было запускать из любого места.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE="docker-compose.yml"
NO_CACHE=""
PROFILE="dev"

usage() {
    cat <<'EOF'
Пересборка сервисов Mikron Wiki.

Использование:
  ./scripts/rebuild.sh [опции] [сервис...]

Опции:
  -p, --prod        Использовать docker-compose.prod.yml (продакшен)
  -c, --no-cache    Собирать образы без использования кэша
  -h, --help        Показать эту справку

Сервисы:
  db, backend, frontend (если не указаны — пересобираются все)
EOF
}

# Разбор аргументов: опции и список сервисов.
SERVICES=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--prod)
            COMPOSE_FILE="docker-compose.prod.yml"
            PROFILE="prod"
            ;;
        -c|--no-cache)
            NO_CACHE="--no-cache"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Неизвестная опция: $1" >&2
            usage
            exit 1
            ;;
        *)
            SERVICES+=("$1")
            ;;
    esac
    shift
done

# Определяем доступную команду compose: docker compose (v2) или docker-compose (v1).
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
else
    echo "Ошибка: не найден ни 'docker compose', ни 'docker-compose'." >&2
    exit 1
fi

cd "$PROJECT_DIR"

if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Ошибка: файл $COMPOSE_FILE не найден в $PROJECT_DIR." >&2
    exit 1
fi

COMPOSE_CMD=("${COMPOSE[@]}" -f "$COMPOSE_FILE")

if [[ ${#SERVICES[@]} -gt 0 ]]; then
    echo ">> Конфигурация: $PROFILE ($COMPOSE_FILE)"
    echo ">> Пересборка сервисов: ${SERVICES[*]}"
    "${COMPOSE_CMD[@]}" build $NO_CACHE "${SERVICES[@]}"
    echo ">> Перезапуск сервисов: ${SERVICES[*]}"
    "${COMPOSE_CMD[@]}" up -d "${SERVICES[@]}"
else
    echo ">> Конфигурация: $PROFILE ($COMPOSE_FILE)"
    echo ">> Пересборка всех сервисов"
    "${COMPOSE_CMD[@]}" build $NO_CACHE
    echo ">> Перезапуск всех сервисов"
    "${COMPOSE_CMD[@]}" up -d
fi

echo ">> Очистка устаревших (dangling) образов"
docker image prune -f >/dev/null 2>&1 || true

echo ">> Готово. Текущий статус:"
"${COMPOSE_CMD[@]}" ps

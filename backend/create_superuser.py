"""
Скрипт для создания суперпользователя Django
"""
import os
import sys
import django

# Настройка Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wiki_backend.settings')
django.setup()

from django.contrib.auth.models import User

def create_superuser():
    username = input('Введите имя пользователя (или нажмите Enter для "admin"): ').strip()
    if not username:
        username = 'admin'
    
    # Проверяем, существует ли пользователь
    if User.objects.filter(username=username).exists():
        print(f'Пользователь "{username}" уже существует!')
        choice = input('Создать нового пользователя? (y/n): ').strip().lower()
        if choice != 'y':
            return
        username = input('Введите новое имя пользователя: ').strip()
        if not username:
            print('Имя пользователя не может быть пустым!')
            return
    
    email = input('Введите email (опционально): ').strip()
    
    password = input('Введите пароль: ').strip()
    if not password:
        print('Пароль не может быть пустым!')
        return
    
    password_confirm = input('Подтвердите пароль: ').strip()
    if password != password_confirm:
        print('Пароли не совпадают!')
        return
    
    try:
        user = User.objects.create_superuser(
            username=username,
            email=email if email else '',
            password=password
        )
        print(f'\n✅ Суперпользователь "{username}" успешно создан!')
        print(f'\nВы можете войти в Django Admin:')
        print(f'   URL: http://localhost:8000/admin')
        print(f'   Username: {username}')
        print(f'   Password: {password}')
    except Exception as e:
        print(f'\n❌ Ошибка при создании пользователя: {e}')

if __name__ == '__main__':
    create_superuser()


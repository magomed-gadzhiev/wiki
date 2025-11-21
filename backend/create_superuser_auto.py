"""
Автоматическое создание суперпользователя Django
"""
import os
import sys
import django

# Настройка Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wiki_backend.settings')
django.setup()

from django.contrib.auth.models import User

def create_superuser_auto(username='admin', email='admin@example.com', password='admin123'):
    """Создает суперпользователя с заданными параметрами"""
    
    # Проверяем, существует ли пользователь
    if User.objects.filter(username=username).exists():
        print(f'[WARNING] Пользователь "{username}" уже существует!')
        print(f'\nИспользуйте эти данные для входа:')
        print(f'   Username: {username}')
        print(f'   URL: http://localhost:8000/admin')
        return False
    
    try:
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        print(f'\n[SUCCESS] Суперпользователь успешно создан!')
        print(f'\nДанные для входа:')
        print(f'   Username: {username}')
        print(f'   Password: {password}')
        print(f'   Email: {email}')
        print(f'\nDjango Admin:')
        print(f'   URL: http://localhost:8000/admin')
        print(f'\n[IMPORTANT] Измените пароль после первого входа!')
        return True
    except Exception as e:
        print(f'\n[ERROR] Ошибка при создании пользователя: {e}')
        return False

if __name__ == '__main__':
    # Можно изменить эти значения
    create_superuser_auto(
        username='admin',
        email='admin@wiki.local',
        password='admin123'
    )


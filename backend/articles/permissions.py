from rest_framework import permissions
from .models import Group


class ArticlePermission(permissions.BasePermission):
    """
    Кастомные права доступа для статей с поддержкой системных прав групп
    """
    
    def has_permission(self, request, view):
        # Суперпользователи имеют все права
        if request.user.is_superuser:
            return True
        
        # Если пользователь не аутентифицирован - нет доступа
        if not request.user.is_authenticated:
            return False
        
        # Получаем системные права пользователя через группы
        system_permission = self._get_system_permission_level(request.user)
        
        # Если пользователь не в группах - нет доступа
        if system_permission is None:
            return False
        
        # Для чтения требуется хотя бы read
        if request.method in permissions.SAFE_METHODS:
            return system_permission in ['read', 'edit']
        
        # Для создания/редактирования требуется edit
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return system_permission == 'edit'
        
        return False
    
    def _get_user_groups(self, user):
        """Получает все группы пользователя"""
        if not user.is_authenticated:
            return Group.objects.none()
        return user.article_groups.all()
    
    def _get_system_permission_level(self, user):
        """
        Определяет максимальный уровень системных прав пользователя через группы.
        Возвращает: 'none', 'read', 'edit' или None (если пользователь не в группах)
        """
        if not user.is_authenticated:
            return None
        
        user_groups = self._get_user_groups(user)
        if not user_groups.exists():
            return None
        
        # Получаем все системные права групп пользователя
        permissions = user_groups.values_list('system_permission_level', flat=True)
        
        if not permissions:
            return None
        
        # Определяем максимальный уровень прав
        # Приоритет: edit > read > none
        if 'edit' in permissions:
            return 'edit'
        elif 'read' in permissions:
            return 'read'
        else:
            return 'none'
    
    def has_object_permission(self, request, view, obj):
        # Суперпользователи имеют все права
        if request.user.is_superuser:
            return True
        
        # Автор статьи имеет все права
        if obj.author == request.user:
            return True
        
        # Получаем системные права пользователя через группы
        system_permission = self._get_system_permission_level(request.user)
        
        # Если пользователь не в группах - нет доступа
        if system_permission is None:
            return False
        
        # Проверка прав на просмотр
        if request.method in permissions.SAFE_METHODS:
            # При праве read или edit видим все статьи (включая черновики для edit)
            if system_permission == 'edit':
                return True
            elif system_permission == 'read':
                # При праве только на чтение видим только опубликованные статьи
                return obj.is_published
            else:
                # Нет доступа
                return False
        
        # Проверка прав на редактирование
        if request.method in ['PUT', 'PATCH']:
            # Только edit может редактировать
            return system_permission == 'edit'
        
        # Проверка прав на удаление
        if request.method == 'DELETE':
            # Только edit может удалять
            return system_permission == 'edit'
        
        return False

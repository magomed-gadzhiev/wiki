from rest_framework import permissions
from .models import Group, CategoryPermission


class ArticlePermission(permissions.BasePermission):
    """
    Кастомные права доступа для статей с поддержкой групп и прав на категории
    """
    
    def has_permission(self, request, view):
        # Суперпользователи имеют все права
        if request.user.is_superuser:
            return True
        
        # Для чтения требуется аутентификация
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # Для создания требуется аутентификация
        if request.method == 'POST':
            return request.user.is_authenticated
        
        return True
    
    def _get_user_groups(self, user):
        """Получает все группы пользователя"""
        if not user.is_authenticated:
            return Group.objects.none()
        return user.article_groups.all()
    
    def _get_category_permission_level(self, user, category):
        """
        Определяет максимальный уровень прав пользователя на категорию через группы.
        Возвращает: 'none', 'read', 'full' или None (если категории нет или нет прав через группы)
        """
        if not user.is_authenticated or not category:
            return None
        
        user_groups = self._get_user_groups(user)
        if not user_groups.exists():
            return None
        
        # Получаем все права групп пользователя на эту категорию
        permissions = CategoryPermission.objects.filter(
            group__in=user_groups,
            category=category
        ).values_list('permission_level', flat=True)
        
        if not permissions:
            return None
        
        # Определяем максимальный уровень прав
        # Приоритет: full > read > none
        if 'full' in permissions:
            return 'full'
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
        
        # Проверяем права через группы на категорию
        category_permission = self._get_category_permission_level(request.user, obj.category)
        
        # Проверка прав на просмотр
        if request.method in permissions.SAFE_METHODS:
            # Получаем группы пользователя
            user_groups = self._get_user_groups(request.user)
            
            # Если пользователь не состоит ни в одной группе
            if not user_groups.exists():
                # Показываем только статьи с индивидуальными правами
                return request.user in obj.can_view.all()
            
            # Если есть права через группы
            if category_permission == 'full':
                return True
            elif category_permission == 'read':
                # При праве только на чтение видим только опубликованные статьи
                return obj.is_published
            elif category_permission == 'none':
                # Нет доступа через группы на эту категорию
                # Проверяем индивидуальные права
                return request.user in obj.can_view.all()
            else:
                # Нет прав через группы на категорию (статья без категории или категория без прав)
                # Показываем только если есть индивидуальные права
                return request.user in obj.can_view.all()
        
        # Проверка прав на редактирование
        if request.method in ['PUT', 'PATCH']:
            # Если есть полные права через группы
            if category_permission == 'full':
                return True
            elif category_permission is not None:
                # Есть права через группы, но не полные
                return False
            else:
                # Нет прав через группы, проверяем старую систему прав
                if request.user in obj.can_edit.all():
                    return True
            return False
        
        # Проверка прав на удаление
        if request.method == 'DELETE':
            # Если есть полные права через группы
            if category_permission == 'full':
                return True
            elif category_permission is not None:
                # Есть права через группы, но не полные
                return False
            else:
                # Нет прав через группы, проверяем старую систему прав
                if request.user in obj.can_delete.all():
                    return True
            return False
        
        return False


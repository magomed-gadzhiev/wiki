from rest_framework import permissions
from .models import Group, Comment


class ArticlePermission(permissions.BasePermission):
    """
    Кастомные права доступа для статей с поддержкой системных прав групп
    и флагов пользователя Django (is_active, is_staff).
    """

    def has_permission(self, request, view):
        # Суперпользователи имеют все права
        if request.user.is_superuser:
            return True

        # Если пользователь не аутентифицирован - нет доступа
        if not request.user.is_authenticated:
            return False

        # Неактивные пользователи не работают с API статей
        if not request.user.is_active:
            return False

        system_permission = self._get_effective_system_permission(request.user)

        if system_permission == 'none':
            return False

        # Для чтения требуется хотя бы read
        if request.method in permissions.SAFE_METHODS:
            return system_permission in ['read', 'edit']

        # Комментарии: создание и правка своих доступны при read (детали в has_object_permission / perform_*)
        if self._is_comment_viewset(view) and request.method in ('POST', 'PUT', 'PATCH'):
            return system_permission in ('read', 'edit')

        # Статьи и прочее: создание/изменение только с edit
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return system_permission == 'edit'

        return False

    @staticmethod
    def _is_comment_viewset(view):
        return view.__class__.__name__ == 'CommentViewSet'
    
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

    def _get_effective_system_permission(self, user):
        """
        Итоговый уровень для API вики: группы + флаги пользователя.

        - is_staff: полный доступ к статьям (как edit), включая черновики
        - is_active без групп: read (опубликованные статьи, комментарии)
        - группы: как раньше; уровень none у явно назначенных групп сохраняется
        """
        if not user.is_authenticated:
            return None
        if not user.is_active:
            return None
        if user.is_staff:
            return 'edit'

        group_level = self._get_system_permission_level(user)
        if group_level is not None:
            return group_level

        # Активный пользователь без групп — читатель опубликованного контента
        return 'read'

    def has_object_permission(self, request, view, obj):
        # Суперпользователи имеют все права
        if request.user.is_superuser:
            return True

        if not request.user.is_authenticated or not request.user.is_active:
            return False

        # Автор объекта (статьи или комментария) имеет полные права на свой объект
        if obj.author == request.user:
            return True

        system_permission = self._get_effective_system_permission(request.user)

        if system_permission == 'none':
            return False

        if isinstance(obj, Comment):
            return self._comment_object_permission(request, obj, system_permission)

        # --- далее объект Article ---

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

    def _comment_object_permission(self, request, obj, system_permission):
        """Права на комментарий (модель Comment, не Article)."""
        if request.method in permissions.SAFE_METHODS:
            if system_permission == 'edit':
                return True
            if system_permission == 'read':
                return obj.article.is_published
            return False
        if request.method in ('PUT', 'PATCH'):
            return system_permission == 'edit'
        if request.method == 'DELETE':
            return system_permission == 'edit'
        return False

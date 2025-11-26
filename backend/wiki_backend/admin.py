"""
Кастомная конфигурация Django Admin для ограничения доступа только суперпользователям
"""
from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth import get_user_model
from django.http import HttpResponseForbidden

User = get_user_model()


class SuperUserAdminSite(AdminSite):
    """
    Кастомный AdminSite, который разрешает доступ только суперпользователям
    """
    def has_permission(self, request):
        """
        Проверяет, является ли пользователь суперпользователем
        """
        return (
            request.user.is_active and
            request.user.is_authenticated and
            request.user.is_superuser
        )

    def login(self, request, extra_context=None):
        """
        Переопределяем метод login для дополнительной проверки после аутентификации
        """
        response = super().login(request, extra_context)
        # После успешного логина проверяем, является ли пользователь суперпользователем
        if request.user.is_authenticated and not request.user.is_superuser:
            from django.contrib.auth import logout
            logout(request)
            return HttpResponseForbidden(
                '<h1>Доступ запрещен</h1>'
                '<p>Доступ к админ-панели имеют только суперпользователи.</p>'
            )
        return response


# Создаем экземпляр кастомного AdminSite
admin_site = SuperUserAdminSite(name='admin')


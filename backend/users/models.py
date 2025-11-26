from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Кастомная модель пользователя с полем для обязательной смены пароля
    """
    must_change_password = models.BooleanField(
        default=False,
        verbose_name='Требуется смена пароля',
        help_text='Если установлено, пользователь должен сменить пароль при первом входе'
    )

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'


"""
Kerberos authentication backend для Django
Поддерживает аутентификацию через Kerberos/SPNEGO
"""
import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend

logger = logging.getLogger(__name__)
User = get_user_model()


class KerberosBackend(BaseBackend):
    """
    Кастомный Kerberos backend, который создает пользователя 
    при необходимости на основе Kerberos principal
    """
    
    def authenticate(self, request, remote_user=None, **kwargs):
        """
        Аутентификация пользователя через Kerberos
        
        Args:
            request: HTTP request объект
            remote_user: Имя пользователя из REMOTE_USER заголовка (устанавливается nginx или другим прокси)
        
        Returns:
            User объект или None
        """
        if not remote_user:
            return None
        
        try:
            # Извлекаем username из Kerberos principal
            # Формат может быть: username@REALM или просто username
            if '@' in remote_user:
                username = remote_user.split('@')[0]
            else:
                username = remote_user
            
            # Нормализуем username (убираем лишние пробелы, приводим к нижнему регистру)
            username = username.strip().lower()
            
            if not username:
                logger.warning(f'Empty username extracted from remote_user: {remote_user}')
                return None
            
            # Получаем или создаем пользователя
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@example.com',
                    'is_active': True,
                }
            )
            
            if created:
                logger.info(f'Created user {username} from Kerberos authentication')
            else:
                logger.debug(f'Authenticated existing user {username} via Kerberos')
            
            return user
            
        except Exception as e:
            logger.error(f'Kerberos authentication error for remote_user={remote_user}: {e}', exc_info=True)
            return None
    
    def get_user(self, user_id):
        """
        Получить пользователя по ID (требуется для Django auth backend)
        """
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None


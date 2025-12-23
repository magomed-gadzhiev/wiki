"""
Middleware для автоматической аутентификации через Kerberos
Используется REMOTE_USER заголовок, который устанавливается nginx или другим прокси
"""
import logging
from django.contrib.auth import authenticate, login

logger = logging.getLogger(__name__)


class KerberosAuthenticationMiddleware:
    """
    Middleware для автоматической аутентификации через Kerberos
    Проверяет REMOTE_USER заголовок и автоматически аутентифицирует пользователя
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Проверяем только если пользователь еще не аутентифицирован
        if not request.user.is_authenticated:
            # Проверяем REMOTE_USER заголовок (устанавливается nginx после Kerberos аутентификации)
            # Может быть в разных форматах: REMOTE_USER или HTTP_REMOTE_USER
            remote_user = (
                request.META.get('REMOTE_USER') or 
                request.META.get('HTTP_REMOTE_USER') or
                request.META.get('HTTP_X_REMOTE_USER')
            )
            
            if remote_user:
                logger.debug(f'Found REMOTE_USER header: {remote_user}')
                user = authenticate(request, remote_user=remote_user)
                if user:
                    login(request, user)
                    logger.info(f'User {user.username} authenticated via Kerberos middleware')
                else:
                    logger.warning(f'Failed to authenticate user from REMOTE_USER: {remote_user}')
        
        response = self.get_response(request)
        return response


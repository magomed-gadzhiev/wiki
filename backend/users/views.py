from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate, login
from django.db.models import Q
from .serializers import UserSerializer
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Регистрация нового пользователя"""
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')
    
    if not username or not password:
        return Response(
            {'error': 'username и password обязательны'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Пользователь с таким username уже существует'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        first_name=first_name,
        last_name=last_name
    )
    
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Авторизация пользователя"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'username и password обязательны'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Неверные учетные данные'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Получить информацию о текущем пользователе"""
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_token(request):
    """Обновить access token"""
    refresh_token = request.data.get('refresh')
    
    if not refresh_token:
        return Response(
            {'error': 'refresh token обязателен'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        refresh = RefreshToken(refresh_token)
        return Response({
            'access': str(refresh.access_token),
        })
    except Exception as e:
        return Response(
            {'error': 'Неверный refresh token'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_list(request):
    """Получить список пользователей для управления правами"""
    search = request.query_params.get('search', '')
    users = User.objects.all()
    
    if search:
        users = users.filter(
            Q(username__icontains=search) |
            Q(email__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)
        )
    
    serializer = UserSerializer(users[:50], many=True)  # Ограничение до 50 пользователей
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Смена пароля пользователя"""
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response(
            {'error': 'old_password и new_password обязательны'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    
    # Проверяем старый пароль
    if not user.check_password(old_password):
        return Response(
            {'error': 'Неверный текущий пароль'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Устанавливаем новый пароль
    user.set_password(new_password)
    # Сбрасываем флаг обязательной смены пароля
    user.must_change_password = False
    user.save()
    
    return Response({
        'message': 'Пароль успешно изменен',
        'user': UserSerializer(user).data
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def kerberos_check(request):
    """
    Проверка наличия Kerberos аутентификации
    Возвращает информацию о пользователе, если Kerberos работает
    """
    # Проверяем REMOTE_USER заголовок (устанавливается nginx или другим прокси после Kerberos аутентификации)
    remote_user = (
        request.META.get('REMOTE_USER') or 
        request.META.get('HTTP_REMOTE_USER') or
        request.META.get('HTTP_X_REMOTE_USER')
    )
    
    if remote_user:
        logger.info(f'Kerberos check: found REMOTE_USER={remote_user}')
        user = authenticate(request, remote_user=remote_user)
        if user:
            login(request, user)
            refresh = RefreshToken.for_user(user)
            logger.info(f'User {user.username} authenticated via Kerberos')
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'kerberos': True
            })
        else:
            logger.warning(f'Failed to authenticate user from REMOTE_USER: {remote_user}')
    
    # Если пользователь уже аутентифицирован через сессию, возвращаем его данные
    if request.user.is_authenticated:
        refresh = RefreshToken.for_user(request.user)
        return Response({
            'user': UserSerializer(request.user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'kerberos': False,
            'message': 'User authenticated via session'
        })
    
    return Response({
        'kerberos': False,
        'message': 'Kerberos authentication not available. REMOTE_USER header not found.'
    }, status=status.HTTP_401_UNAUTHORIZED)


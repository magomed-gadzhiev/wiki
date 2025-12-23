from django.urls import path
from .views import register, login, me, refresh_token, users_list, change_password, kerberos_check

urlpatterns = [
    path('register/', register, name='register'),
    path('login/', login, name='login'),
    path('me/', me, name='me'),
    path('refresh/', refresh_token, name='refresh'),
    path('users/', users_list, name='users-list'),
    path('change-password/', change_password, name='change-password'),
    path('kerberos-check/', kerberos_check, name='kerberos-check'),
]


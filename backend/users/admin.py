from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm, UserCreationForm as BaseUserCreationForm
from django.forms import CharField, PasswordInput
from django.contrib.auth.forms import ReadOnlyPasswordHashWidget
from django.core.exceptions import ValidationError
from wiki_backend.admin import admin_site
from .models import User


class UserChangeForm(BaseUserChangeForm):
    """Кастомная форма для изменения пользователя с полями для смены пароля"""
    
    password1 = CharField(
        label=_("Новый пароль"),
        widget=PasswordInput(attrs={'autocomplete': 'new-password', 'class': 'vTextField'}),
        required=False,
        help_text=_("Оставьте пустым, если не хотите менять пароль. Если пароль изменен, пользователю потребуется сменить его при следующем входе."),
    )
    password2 = CharField(
        label=_("Подтверждение нового пароля"),
        widget=PasswordInput(attrs={'autocomplete': 'new-password', 'class': 'vTextField'}),
        required=False,
        help_text=_("Введите тот же пароль, что и выше, для проверки."),
    )
    
    class Meta:
        model = User
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Сохраняем старый хеш пароля для сравнения
        if self.instance and self.instance.pk:
            self._old_password_hash = self.instance.password
        else:
            self._old_password_hash = None
        
        # Заменяем поле password на ReadOnlyPasswordHashWidget
        if 'password' in self.fields:
            self.fields['password'].widget = ReadOnlyPasswordHashWidget()
            self.fields['password'].help_text = _(
                "Raw passwords are not stored, so there is no way to see this "
                "user's password, but you can change the password using "
                "<strong>Новый пароль</strong> and <strong>Подтверждение нового пароля</strong> fields below."
            )
    
    def clean_password2(self):
        """Валидация совпадения паролей"""
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        
        if password1 and password2:
            if password1 != password2:
                raise ValidationError(_("Пароли не совпадают."))
        
        return password2
    
    def save(self, commit=True):
        """Сохраняем пользователя с новым паролем, если он указан"""
        user = super().save(commit=False)
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        
        if password1 and password1 == password2:
            user.set_password(password1)
            user.must_change_password = True
        
        if commit:
            user.save()
        
        return user


class UserCreationForm(BaseUserCreationForm):
    """Кастомная форма для создания пользователя"""
    
    class Meta:
        model = User
        fields = ('username',)


# Расширяем стандартный UserAdmin
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_staff', 'must_change_password', 'date_joined']
    list_filter = ['is_staff', 'is_superuser', 'is_active', 'must_change_password', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    # Явно определяем fieldsets с полями пароля
    fieldsets = (
        (None, {'fields': ('username',)}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Password'), {
            'fields': ('password', 'password1', 'password2'),
            'description': _("Измените пароль пользователя. Если пароль изменен, пользователю потребуется сменить его при следующем входе."),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2'),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """
        Переопределяем сохранение модели для установки флага must_change_password
        при изменении пароля в админке
        """
        # Форма уже обработала пароль в методе save(), просто вызываем родительский метод
        super().save_model(request, obj, form, change)


# Регистрируем User в кастомном admin_site
admin_site.register(User, UserAdmin)


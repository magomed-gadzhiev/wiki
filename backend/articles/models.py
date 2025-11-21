from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class Section(models.Model):
    """Модель раздела для категорий"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Название')
    slug = models.SlugField(max_length=255, unique=True, blank=True, verbose_name='URL')
    description = models.TextField(blank=True, verbose_name='Описание')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Раздел'
        verbose_name_plural = 'Разделы'
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['sort_order', 'name']),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        # Автоматическое создание slug из названия, если не указан
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Category(models.Model):
    """Модель категории статей"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Название')
    slug = models.SlugField(max_length=255, unique=True, blank=True, verbose_name='URL')
    description = models.TextField(blank=True, verbose_name='Описание')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='categories', verbose_name='Раздел')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['section', 'sort_order', 'name']
        indexes = [
            models.Index(fields=['section', 'sort_order', 'name']),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        # Автоматическое создание slug из названия, если не указан
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Tag(models.Model):
    """Модель тега для статей"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, verbose_name='Название')
    slug = models.SlugField(max_length=100, unique=True, blank=True, verbose_name='URL')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Тег'
        verbose_name_plural = 'Теги'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        # Автоматическое создание slug из названия, если не указан
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            
            # Проверяем уникальность slug и добавляем суффикс, если нужно
            # Но только если это новый объект (pk еще не установлен)
            while Tag.objects.filter(slug=slug).exclude(pk=self.pk if self.pk else None).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                # Защита от бесконечного цикла
                if counter > 1000:
                    break
            
            self.slug = slug
        super().save(*args, **kwargs)


class Article(models.Model):
    """Модель статьи вики"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, verbose_name='Заголовок')
    content = models.TextField(verbose_name='Содержимое (HTML)')
    summary = models.TextField(blank=True, verbose_name='Краткое описание')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='articles', verbose_name='Категория')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='articles', verbose_name='Автор')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    is_published = models.BooleanField(default=False, verbose_name='Опубликовано')
    view_count = models.IntegerField(default=0, verbose_name='Просмотры')
    
    # Права доступа
    can_view = models.ManyToManyField(User, related_name='viewable_articles', blank=True, verbose_name='Могут просматривать')
    can_edit = models.ManyToManyField(User, related_name='editable_articles', blank=True, verbose_name='Могут редактировать')
    can_delete = models.ManyToManyField(User, related_name='deletable_articles', blank=True, verbose_name='Могут удалять')
    
    # Теги
    tags = models.ManyToManyField('Tag', related_name='articles', blank=True, verbose_name='Теги')
    
    class Meta:
        verbose_name = 'Статья'
        verbose_name_plural = 'Статьи'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['-updated_at']),
        ]

    def __str__(self):
        return self.title


class ArticleVersion(models.Model):
    """Модель версии статьи для версионирования"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='versions', verbose_name='Статья')
    title = models.CharField(max_length=255, verbose_name='Заголовок')
    content = models.TextField(verbose_name='Содержимое (HTML)')
    summary = models.TextField(blank=True, verbose_name='Краткое описание')
    version_number = models.IntegerField(verbose_name='Номер версии')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='article_versions', verbose_name='Автор версии')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    change_description = models.TextField(blank=True, verbose_name='Описание изменений')
    
    class Meta:
        verbose_name = 'Версия статьи'
        verbose_name_plural = 'Версии статей'
        ordering = ['-version_number']
        unique_together = [['article', 'version_number']]
        indexes = [
            models.Index(fields=['article', '-version_number']),
        ]

    def __str__(self):
        return f"{self.article.title} - версия {self.version_number}"


class ArticleImage(models.Model):
    """Модель для хранения изображений статей"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='images', verbose_name='Статья')
    image = models.ImageField(upload_to='articles/images/', verbose_name='Изображение')
    alt_text = models.CharField(max_length=255, blank=True, verbose_name='Альтернативный текст')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Загружено')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name='Загрузил')

    class Meta:
        verbose_name = 'Изображение статьи'
        verbose_name_plural = 'Изображения статей'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.article.title} - {self.image.name}"


class ArticleOption(models.Model):
    """Модель опции для статей (название опции, заносится в админке)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, verbose_name='Название опции')
    description = models.TextField(blank=True, verbose_name='Описание')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Опция статьи'
        verbose_name_plural = 'Опции статей'
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['sort_order', 'name']),
        ]
    
    def __str__(self):
        return self.name


class ArticleOptionValue(models.Model):
    """Модель значения опции для конкретной статьи"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='option_values', verbose_name='Статья')
    option = models.ForeignKey(ArticleOption, on_delete=models.CASCADE, related_name='values', verbose_name='Опция')
    value = models.TextField(blank=True, verbose_name='Значение')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Значение опции статьи'
        verbose_name_plural = 'Значения опций статей'
        unique_together = [['article', 'option']]
        ordering = ['option__sort_order', 'option__name']
        indexes = [
            models.Index(fields=['article', 'option']),
        ]
    
    def __str__(self):
        return f"{self.article.title} - {self.option.name}: {self.value[:50]}"


class Group(models.Model):
    """Модель группы пользователей"""
    PERMISSION_LEVELS = [
        ('none', 'Нет доступа'),
        ('read', 'Только чтение'),
        ('full', 'Полные права'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, verbose_name='Название группы')
    description = models.TextField(blank=True, verbose_name='Описание')
    users = models.ManyToManyField(User, related_name='article_groups', blank=True, verbose_name='Пользователи')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Группа пользователей'
        verbose_name_plural = 'Группы пользователей'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return self.name


class CategoryPermission(models.Model):
    """Модель прав группы на категорию статей"""
    PERMISSION_LEVELS = [
        ('none', 'Нет доступа'),
        ('read', 'Только чтение'),
        ('full', 'Полные права'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='category_permissions', verbose_name='Группа')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='group_permissions', verbose_name='Категория')
    permission_level = models.CharField(max_length=10, choices=PERMISSION_LEVELS, default='none', verbose_name='Уровень доступа')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Право доступа группы на категорию'
        verbose_name_plural = 'Права доступа групп на категории'
        unique_together = [['group', 'category']]
        ordering = ['group__name', 'category__name']
        indexes = [
            models.Index(fields=['group', 'category']),
            models.Index(fields=['category', 'permission_level']),
        ]
    
    def __str__(self):
        return f"{self.group.name} - {self.category.name}: {self.get_permission_level_display()}"


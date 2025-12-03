from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()
import uuid


class Technology(models.Model):
    """Модель технологии"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Название')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Технология'
        verbose_name_plural = 'Технологии'
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['sort_order', 'name']),
        ]
    
    def __str__(self):
        return self.name


class Element(models.Model):
    """Модель элемента"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Название')
    technology = models.ForeignKey(Technology, on_delete=models.SET_NULL, null=True, blank=True, related_name='elements', verbose_name='Технология')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    
    class Meta:
        verbose_name = 'Элемент'
        verbose_name_plural = 'Элементы'
        ordering = ['technology', 'sort_order', 'name']
        indexes = [
            models.Index(fields=['technology', 'sort_order', 'name']),
        ]
    
    def __str__(self):
        return self.name


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
    model_name = models.CharField(max_length=255, verbose_name='Модель')
    content = models.TextField(blank=True, default='', verbose_name='Содержимое (HTML)')
    summary = models.TextField(blank=True, verbose_name='Краткое описание')
    element = models.ForeignKey('Element', on_delete=models.SET_NULL, null=True, blank=True, related_name='articles', verbose_name='Элемент')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='articles', verbose_name='Автор')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    is_published = models.BooleanField(default=False, verbose_name='Опубликовано')
    view_count = models.IntegerField(default=0, verbose_name='Просмотры')
    is_deleted = models.BooleanField(default=False, verbose_name='Удалено')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата удаления')
    
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
        return self.model_name


class ArticleVersion(models.Model):
    """Модель версии статьи для версионирования"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='versions', verbose_name='Статья')
    model_name = models.CharField(max_length=255, verbose_name='Модель')
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
        return f"{self.article.model_name} - версия {self.version_number}"


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
        return f"{self.article.model_name} - {self.image.name}"


class ArticleAttachment(models.Model):
    """Модель для хранения вложений (файлов) статей"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='attachments', verbose_name='Статья')
    file = models.FileField(upload_to='articles/attachments/', verbose_name='Файл')
    filename = models.CharField(max_length=255, verbose_name='Имя файла')
    file_size = models.BigIntegerField(verbose_name='Размер файла (байт)')
    comment = models.TextField(blank=True, verbose_name='Комментарий')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Загружено')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name='Загрузил')

    class Meta:
        verbose_name = 'Вложение статьи'
        verbose_name_plural = 'Вложения статей'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['article', '-uploaded_at']),
        ]

    def __str__(self):
        return f"{self.article.model_name} - {self.filename}"
    
    def save(self, *args, **kwargs):
        # Автоматически сохраняем имя файла и размер при сохранении
        if self.file and not self.filename:
            self.filename = self.file.name
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)


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
        return f"{self.article.model_name} - {self.option.name}: {self.value[:50]}"


class Group(models.Model):
    """Модель группы пользователей"""
    PERMISSION_LEVELS = [
        ('none', 'Нет доступа'),
        ('read', 'Чтение'),
        ('edit', 'Редактирование'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, verbose_name='Название группы')
    description = models.TextField(blank=True, verbose_name='Описание')
    system_permission_level = models.CharField(max_length=10, choices=PERMISSION_LEVELS, default='none', verbose_name='Уровень доступа к системе')
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


class ArticleTemplate(models.Model):
    """Модель шаблона статьи"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Название')
    html = models.TextField(verbose_name='HTML содержимое')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Шаблон статьи'
        verbose_name_plural = 'Шаблоны статей'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return self.name


class Comment(models.Model):
    """Модель комментария к статье"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='comments', verbose_name='Статья')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='comments', verbose_name='Автор')
    content = models.TextField(verbose_name='Содержимое (HTML)')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies', verbose_name='Родительский комментарий')
    referenced_comments = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='referenced_by', verbose_name='Ссылки на комментарии')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Комментарий'
        verbose_name_plural = 'Комментарии'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['article', 'created_at']),
            models.Index(fields=['parent', 'created_at']),
        ]
    
    def __str__(self):
        author_name = self.author.username if self.author else 'Неизвестный'
        content_preview = self.content[:50] if self.content else ''
        return f"{author_name}: {content_preview}"




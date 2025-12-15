from django.contrib import admin
from .models import Article, ArticleVersion, ArticleImage, ArticleAttachment, Category, Model, Technology, Tag, ArticleOption, ArticleOptionValue, Group, ArticleTemplate, Comment


# Импортируем admin_site внутри функций регистрации, чтобы избежать циклических зависимостей
def register_models():
    """Регистрируем модели в кастомном admin_site"""
    from wiki_backend.admin import admin_site
    
    class TechnologyAdmin(admin.ModelAdmin):
        list_display = ['name', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        list_filter = ['created_at']
        search_fields = ['name']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'sort_order')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class CategoryAdmin(admin.ModelAdmin):
        list_display = ['name', 'technology', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        list_filter = ['technology', 'created_at']
        search_fields = ['name']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'technology', 'sort_order')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class ModelAdmin(admin.ModelAdmin):
        list_display = ['name', 'category', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        list_filter = ['category', 'created_at']
        search_fields = ['name']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'category', 'sort_order')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class TagAdmin(admin.ModelAdmin):
        list_display = ['name', 'slug', 'created_at']
        search_fields = ['name', 'slug']
        prepopulated_fields = {'slug': ('name',)}
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'slug')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class ArticleAdmin(admin.ModelAdmin):
        list_display = ['model_name', 'model', 'author', 'is_published', 'view_count', 'created_at', 'updated_at']
        list_filter = ['is_published', 'model', 'created_at', 'updated_at']
        search_fields = ['model_name', 'content']
        filter_horizontal = ['can_view', 'can_edit', 'can_delete', 'tags']
        readonly_fields = ['id', 'created_at', 'updated_at', 'view_count', 'table_of_contents']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('model_name', 'summary', 'content', 'model', 'author', 'is_published')
            }),
            ('Теги', {
                'fields': ('tags',)
            }),
            ('Права доступа', {
                'fields': ('can_view', 'can_edit', 'can_delete')
            }),
            ('Навигация', {
                'fields': ('table_of_contents',),
                'description': 'Содержание статьи (генерируется автоматически при сохранении)'
            }),
            ('Статистика', {
                'fields': ('view_count', 'created_at', 'updated_at')
            }),
        )
    
    class ArticleVersionAdmin(admin.ModelAdmin):
        list_display = ['article', 'version_number', 'author', 'created_at']
        list_filter = ['created_at']
        search_fields = ['article__model_name', 'content']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('article', 'version_number', 'model_name', 'summary', 'content', 'author', 'change_description')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class ArticleImageAdmin(admin.ModelAdmin):
        list_display = ['article', 'image', 'alt_text', 'uploaded_by', 'uploaded_at']
        list_filter = ['uploaded_at']
        search_fields = ['article__model_name', 'alt_text']
        readonly_fields = ['id', 'uploaded_at']
    
    class ArticleAttachmentAdmin(admin.ModelAdmin):
        list_display = ['article', 'filename', 'file_size', 'uploaded_by', 'uploaded_at']
        list_filter = ['uploaded_at']
        search_fields = ['article__model_name', 'filename', 'comment']
        readonly_fields = ['id', 'filename', 'file_size', 'uploaded_at']
        fields = ['article', 'file', 'filename', 'file_size', 'comment', 'uploaded_by', 'uploaded_at']
    
    class ArticleOptionAdmin(admin.ModelAdmin):
        list_display = ['name', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        search_fields = ['name', 'description']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'description', 'sort_order')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class ArticleOptionValueAdmin(admin.ModelAdmin):
        list_display = ['article', 'option', 'value', 'updated_at']
        list_filter = ['option', 'updated_at']
        search_fields = ['article__model_name', 'option__name', 'value']
        readonly_fields = ['id', 'created_at', 'updated_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('article', 'option', 'value')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at', 'updated_at')
            }),
        )
    
    class GroupAdmin(admin.ModelAdmin):
        list_display = ['name', 'system_permission_level', 'users_count', 'created_at', 'updated_at']
        list_filter = ['system_permission_level', 'created_at', 'updated_at']
        search_fields = ['name', 'description']
        filter_horizontal = ['users']
        readonly_fields = ['id', 'created_at', 'updated_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'description', 'system_permission_level')
            }),
            ('Пользователи', {
                'fields': ('users',)
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at', 'updated_at')
            }),
        )
        
        def users_count(self, obj):
            return obj.users.count()
        users_count.short_description = 'Количество пользователей'
    
    class ArticleTemplateAdmin(admin.ModelAdmin):
        list_display = ['name', 'created_at', 'updated_at']
        search_fields = ['name']
        readonly_fields = ['id', 'created_at', 'updated_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'html')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at', 'updated_at')
            }),
        )
    
    class CommentAdmin(admin.ModelAdmin):
        list_display = ['article', 'author', 'created_at', 'parent']
        list_filter = ['created_at', 'article']
        search_fields = ['content', 'article__model_name', 'author__username']
        readonly_fields = ['id', 'created_at', 'updated_at']
        filter_horizontal = ['referenced_comments']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('article', 'author', 'content', 'parent')
            }),
            ('Ссылки', {
                'fields': ('referenced_comments',)
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at', 'updated_at')
            }),
        )
    
    # Регистрируем все модели
    admin_site.register(Technology, TechnologyAdmin)
    admin_site.register(Category, CategoryAdmin)
    admin_site.register(Model, ModelAdmin)
    admin_site.register(Tag, TagAdmin)
    admin_site.register(Article, ArticleAdmin)
    admin_site.register(ArticleVersion, ArticleVersionAdmin)
    admin_site.register(ArticleImage, ArticleImageAdmin)
    admin_site.register(ArticleAttachment, ArticleAttachmentAdmin)
    admin_site.register(ArticleOption, ArticleOptionAdmin)
    admin_site.register(ArticleOptionValue, ArticleOptionValueAdmin)
    admin_site.register(Group, GroupAdmin)
    admin_site.register(ArticleTemplate, ArticleTemplateAdmin)
    admin_site.register(Comment, CommentAdmin)


# Вызываем регистрацию при импорте модуля
register_models()

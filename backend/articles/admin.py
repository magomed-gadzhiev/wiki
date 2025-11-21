from django.contrib import admin
from .models import Article, ArticleVersion, ArticleImage, Category, Section, Tag, ArticleOption, ArticleOptionValue, Group, CategoryPermission


# Импортируем admin_site внутри функций регистрации, чтобы избежать циклических зависимостей
def register_models():
    """Регистрируем модели в кастомном admin_site"""
    from wiki_backend.admin import admin_site
    
    class SectionAdmin(admin.ModelAdmin):
        list_display = ['name', 'slug', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        list_filter = ['created_at']
        search_fields = ['name', 'slug', 'description']
        prepopulated_fields = {'slug': ('name',)}
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'slug', 'description', 'sort_order')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class CategoryAdmin(admin.ModelAdmin):
        list_display = ['name', 'slug', 'section', 'sort_order', 'created_at']
        list_editable = ['sort_order']
        list_filter = ['section', 'created_at']
        search_fields = ['name', 'slug', 'description']
        prepopulated_fields = {'slug': ('name',)}
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'slug', 'description', 'section', 'sort_order')
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
        list_display = ['title', 'category', 'author', 'is_published', 'view_count', 'created_at', 'updated_at']
        list_filter = ['is_published', 'category', 'created_at', 'updated_at']
        search_fields = ['title', 'content']
        filter_horizontal = ['can_view', 'can_edit', 'can_delete', 'tags']
        readonly_fields = ['id', 'created_at', 'updated_at', 'view_count']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('title', 'summary', 'content', 'category', 'author', 'is_published')
            }),
            ('Теги', {
                'fields': ('tags',)
            }),
            ('Права доступа', {
                'fields': ('can_view', 'can_edit', 'can_delete')
            }),
            ('Статистика', {
                'fields': ('view_count', 'created_at', 'updated_at')
            }),
        )
    
    class ArticleVersionAdmin(admin.ModelAdmin):
        list_display = ['article', 'version_number', 'author', 'created_at']
        list_filter = ['created_at']
        search_fields = ['article__title', 'content']
        readonly_fields = ['id', 'created_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('article', 'version_number', 'title', 'summary', 'content', 'author', 'change_description')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at')
            }),
        )
    
    class ArticleImageAdmin(admin.ModelAdmin):
        list_display = ['article', 'image', 'alt_text', 'uploaded_by', 'uploaded_at']
        list_filter = ['uploaded_at']
        search_fields = ['article__title', 'alt_text']
        readonly_fields = ['id', 'uploaded_at']
    
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
        search_fields = ['article__title', 'option__name', 'value']
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
        list_display = ['name', 'users_count', 'created_at', 'updated_at']
        list_filter = ['created_at', 'updated_at']
        search_fields = ['name', 'description']
        filter_horizontal = ['users']
        readonly_fields = ['id', 'created_at', 'updated_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('name', 'description')
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
    
    class CategoryPermissionAdmin(admin.ModelAdmin):
        list_display = ['group', 'category', 'permission_level', 'created_at', 'updated_at']
        list_filter = ['permission_level', 'created_at', 'updated_at']
        search_fields = ['group__name', 'category__name']
        readonly_fields = ['id', 'created_at', 'updated_at']
        
        fieldsets = (
            ('Основная информация', {
                'fields': ('group', 'category', 'permission_level')
            }),
            ('Метаданные', {
                'fields': ('id', 'created_at', 'updated_at')
            }),
        )
    
    # Регистрируем все модели
    admin_site.register(Section, SectionAdmin)
    admin_site.register(Category, CategoryAdmin)
    admin_site.register(Tag, TagAdmin)
    admin_site.register(Article, ArticleAdmin)
    admin_site.register(ArticleVersion, ArticleVersionAdmin)
    admin_site.register(ArticleImage, ArticleImageAdmin)
    admin_site.register(ArticleOption, ArticleOptionAdmin)
    admin_site.register(ArticleOptionValue, ArticleOptionValueAdmin)
    admin_site.register(Group, GroupAdmin)
    admin_site.register(CategoryPermission, CategoryPermissionAdmin)


# Вызываем регистрацию при импорте модуля
register_models()

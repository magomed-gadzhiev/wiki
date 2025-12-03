from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()
from .models import Article, ArticleVersion, ArticleImage, ArticleAttachment, Element, Technology, Tag, ArticleOption, ArticleOptionValue, Group, ArticleTemplate, Comment


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class ElementSimpleSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор элемента без технологии (для использования в TechnologySerializer)"""
    class Meta:
        model = Element
        fields = ['id', 'name', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class TechnologySerializer(serializers.ModelSerializer):
    elements = serializers.SerializerMethodField()
    
    class Meta:
        model = Technology
        fields = ['id', 'name', 'sort_order', 'created_at', 'elements']
        read_only_fields = ['id', 'created_at']
    
    def get_elements(self, obj):
        """Возвращает список всех элементов технологии"""
        elements = obj.elements.all().order_by('sort_order', 'name')
        return ElementSimpleSerializer(elements, many=True).data


class TechnologySimpleSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор технологии без элементов (для использования в ElementSerializer)"""
    class Meta:
        model = Technology
        fields = ['id', 'name', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class ElementSerializer(serializers.ModelSerializer):
    technology = TechnologySimpleSerializer(read_only=True)
    
    class Meta:
        model = Element
        fields = ['id', 'name', 'technology', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class TagSerializer(serializers.ModelSerializer):
    """Сериализатор для тегов"""
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'name': {'validators': []}  # Отключаем стандартную валидацию уникальности
        }
    
    def validate_name(self, value):
        """Валидация имени тега - проверяем существование, но не выдаем ошибку"""
        if value:
            value = value.strip()
            # Проверяем существование тега (без учета регистра)
            existing_tag = Tag.objects.filter(name__iexact=value).first()
            if existing_tag:
                # Если тег существует, сохраняем его в контексте для использования в create()
                self.context['existing_tag'] = existing_tag
        return value
    
    def create(self, validated_data):
        # Если тег уже существует, возвращаем его
        if 'existing_tag' in self.context:
            return self.context['existing_tag']
        
        # Если тег не найден, создаем новый
        return super().create(validated_data)


class ArticleImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ArticleImage
        fields = ['id', 'image', 'image_url', 'alt_text', 'uploaded_at', 'uploaded_by']
        read_only_fields = ['uploaded_at', 'uploaded_by']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ArticleAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    file_size_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ArticleAttachment
        fields = ['id', 'file', 'file_url', 'filename', 'file_size', 'file_size_display', 
                  'comment', 'uploaded_at', 'uploaded_by', 'uploaded_by_username']
        read_only_fields = ['id', 'filename', 'file_size', 'uploaded_at', 'uploaded_by']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_file_size_display(self, obj):
        """Возвращает размер файла в читаемом формате"""
        size = obj.file_size
        for unit in ['Б', 'КБ', 'МБ', 'ГБ']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} ТБ"


class ArticleOptionSerializer(serializers.ModelSerializer):
    """Сериализатор для опций статей"""
    class Meta:
        model = ArticleOption
        fields = ['id', 'name', 'description', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class ArticleOptionValueSerializer(serializers.ModelSerializer):
    """Сериализатор для значений опций статей"""
    option = ArticleOptionSerializer(read_only=True)
    option_id = serializers.PrimaryKeyRelatedField(
        queryset=ArticleOption.objects.all(),
        source='option',
        write_only=True
    )
    
    class Meta:
        model = ArticleOptionValue
        fields = ['id', 'option', 'option_id', 'value', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ArticleVersionSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    
    class Meta:
        model = ArticleVersion
        fields = ['id', 'article', 'model_name', 'content', 'summary', 'version_number', 
                  'author', 'created_at', 'change_description']
        read_only_fields = ['id', 'created_at', 'author']


class ArticleSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    element = ElementSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    can_view = UserSerializer(many=True, read_only=True)
    can_edit = UserSerializer(many=True, read_only=True)
    can_delete = UserSerializer(many=True, read_only=True)
    images = ArticleImageSerializer(many=True, read_only=True)
    attachments = ArticleAttachmentSerializer(many=True, read_only=True)
    option_values = ArticleOptionValueSerializer(many=True, read_only=True)
    versions_count = serializers.IntegerField(source='versions.count', read_only=True)
    latest_version = serializers.SerializerMethodField()
    
    # Для записи элемента
    element_id = serializers.PrimaryKeyRelatedField(
        queryset=Element.objects.all(),
        source='element',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    # Для записи тегов
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Tag.objects.all(),
        source='tags',
        write_only=True,
        required=False
    )
    
    # Для записи прав доступа
    can_view_ids = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=User.objects.all(), 
        source='can_view',
        write_only=True,
        required=False
    )
    can_edit_ids = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=User.objects.all(), 
        source='can_edit',
        write_only=True,
        required=False
    )
    can_delete_ids = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=User.objects.all(), 
        source='can_delete',
        write_only=True,
        required=False
    )
    
    # Для записи значений опций
    option_values_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Article
        fields = [
            'id', 'model_name', 'content', 'summary', 'author', 
            'created_at', 'updated_at', 'is_published', 'view_count',
            'element', 'element_id',
            'tags', 'tag_ids',
            'can_view', 'can_edit', 'can_delete',
            'can_view_ids', 'can_edit_ids', 'can_delete_ids',
            'images', 'attachments', 'option_values', 'option_values_data',
            'versions_count', 'latest_version',
            'is_deleted', 'deleted_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at', 'view_count', 'is_deleted', 'deleted_at']
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True}
        }
    
    def get_latest_version(self, obj):
        latest = obj.versions.first()
        if latest:
            return ArticleVersionSerializer(latest).data
        return None
    
    def create(self, validated_data):
        option_values_data = validated_data.pop('option_values_data', [])
        validated_data['author'] = self.context['request'].user
        # Все новые статьи создаются как черновики
        validated_data['is_published'] = False
        article = super().create(validated_data)
        
        # Создаем значения опций
        self._update_option_values(article, option_values_data)
        
        return article
    
    def update(self, instance, validated_data):
        option_values_data = validated_data.pop('option_values_data', None)
        article = super().update(instance, validated_data)
        
        # Обновляем значения опций, если они переданы
        if option_values_data is not None:
            self._update_option_values(article, option_values_data)
        
        return article
    
    def _update_option_values(self, article, option_values_data):
        """Обновляет значения опций для статьи"""
        if not option_values_data:
            return
        
        for option_data in option_values_data:
            option_id = option_data.get('option_id')
            value = option_data.get('value', '')
            
            if option_id:
                try:
                    option = ArticleOption.objects.get(id=option_id)
                    ArticleOptionValue.objects.update_or_create(
                        article=article,
                        option=option,
                        defaults={'value': value}
                    )
                except ArticleOption.DoesNotExist:
                    pass  # Игнорируем несуществующие опции


class ArticleListSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор для списка статей"""
    author = UserSerializer(read_only=True)
    element = ElementSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Article
        fields = ['id', 'model_name', 'summary', 'author', 'element', 'tags', 'created_at', 
                  'updated_at', 'is_published', 'view_count']


class GroupSerializer(serializers.ModelSerializer):
    """Сериализатор для групп пользователей"""
    users = UserSerializer(many=True, read_only=True)
    users_count = serializers.IntegerField(source='users.count', read_only=True)
    system_permission_level_display = serializers.CharField(source='get_system_permission_level_display', read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        source='users',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'system_permission_level', 'system_permission_level_display', 
                  'users', 'user_ids', 'users_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class GroupDetailSerializer(serializers.ModelSerializer):
    """Детальный сериализатор группы"""
    users = UserSerializer(many=True, read_only=True)
    users_count = serializers.IntegerField(source='users.count', read_only=True)
    system_permission_level_display = serializers.CharField(source='get_system_permission_level_display', read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        source='users',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'system_permission_level', 'system_permission_level_display',
                  'users', 'user_ids', 'users_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ArticleTemplateSerializer(serializers.ModelSerializer):
    """Сериализатор для шаблонов статей"""
    class Meta:
        model = ArticleTemplate
        fields = ['id', 'name', 'html', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CommentSerializer(serializers.ModelSerializer):
    """Сериализатор для комментариев"""
    author = UserSerializer(read_only=True)
    article = serializers.PrimaryKeyRelatedField(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(read_only=True)
    referenced_comments = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    
    # Для записи
    article_id = serializers.PrimaryKeyRelatedField(
        queryset=Article.objects.all(),
        source='article',
        write_only=True
    )
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(),
        source='parent',
        write_only=True,
        required=False,
        allow_null=True
    )
    referenced_comment_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Comment.objects.all(),
        source='referenced_comments',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Comment
        fields = [
            'id', 'article', 'article_id', 'author', 'content', 
            'parent', 'parent_id', 'referenced_comments', 'referenced_comment_ids',
            'replies', 'replies_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_referenced_comments(self, obj):
        """Возвращает список ссылок на комментарии"""
        referenced = obj.referenced_comments.all()
        return CommentSimpleSerializer(referenced, many=True, context=self.context).data
    
    def get_replies(self, obj):
        """Возвращает вложенные ответы"""
        replies = obj.replies.all().order_by('created_at')
        # Используем CommentSimpleSerializer для избежания бесконечной рекурсии
        return CommentSimpleSerializer(replies, many=True, context=self.context).data
    
    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        referenced_comment_ids = validated_data.pop('referenced_comments', [])
        comment = super().create(validated_data)
        
        # Добавляем ссылки на комментарии
        if referenced_comment_ids:
            comment.referenced_comments.set(referenced_comment_ids)
        
        return comment
    
    def update(self, instance, validated_data):
        referenced_comment_ids = validated_data.pop('referenced_comments', None)
        comment = super().update(instance, validated_data)
        
        # Обновляем ссылки на комментарии, если они переданы
        if referenced_comment_ids is not None:
            comment.referenced_comments.set(referenced_comment_ids)
        
        return comment


class CommentSimpleSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор комментария (для вложенных комментариев и ссылок)"""
    author = UserSerializer(read_only=True)
    referenced_comments = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'author', 'content', 'referenced_comments', 'replies', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_referenced_comments(self, obj):
        """Возвращает список ссылок на комментарии"""
        referenced = obj.referenced_comments.all()
        return [{'id': str(ref.id), 'author': {'username': ref.author.username if ref.author else 'Неизвестный'}} for ref in referenced]
    
    def get_replies(self, obj):
        """Возвращает вложенные ответы (один уровень вложенности)"""
        replies = obj.replies.all().order_by('created_at')
        return [{
            'id': str(reply.id),
            'author': UserSerializer(reply.author).data if reply.author else None,
            'content': reply.content,
            'referenced_comments': [{'id': str(ref.id), 'author': {'username': ref.author.username if ref.author else 'Неизвестный'}} for ref in reply.referenced_comments.all()],
            'replies': [],  # Не показываем вложенные ответы в ответах, чтобы избежать глубокой рекурсии
            'created_at': reply.created_at.isoformat() if reply.created_at else None,
            'updated_at': reply.updated_at.isoformat() if reply.updated_at else None
        } for reply in replies]


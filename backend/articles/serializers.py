from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Article, ArticleVersion, ArticleImage, Category, Section, Tag, ArticleOption, ArticleOptionValue, Group, CategoryPermission


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class CategorySimpleSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор категории без раздела (для использования в SectionSerializer)"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class SectionSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = ['id', 'name', 'slug', 'description', 'sort_order', 'created_at', 'categories']
        read_only_fields = ['id', 'created_at']
    
    def get_categories(self, obj):
        """Возвращает список категорий раздела"""
        categories = obj.categories.all().order_by('sort_order', 'name')
        return CategorySimpleSerializer(categories, many=True).data


class SectionSimpleSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор раздела без категорий (для использования в CategorySerializer)"""
    class Meta:
        model = Section
        fields = ['id', 'name', 'slug', 'description', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class CategorySerializer(serializers.ModelSerializer):
    section = SectionSimpleSerializer(read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'section', 'sort_order', 'created_at']
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
        fields = ['id', 'article', 'title', 'content', 'summary', 'version_number', 
                  'author', 'created_at', 'change_description']
        read_only_fields = ['id', 'created_at', 'author']


class ArticleSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    can_view = UserSerializer(many=True, read_only=True)
    can_edit = UserSerializer(many=True, read_only=True)
    can_delete = UserSerializer(many=True, read_only=True)
    images = ArticleImageSerializer(many=True, read_only=True)
    option_values = ArticleOptionValueSerializer(many=True, read_only=True)
    versions_count = serializers.IntegerField(source='versions.count', read_only=True)
    latest_version = serializers.SerializerMethodField()
    
    # Для записи категории
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
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
            'id', 'title', 'content', 'summary', 'author', 
            'created_at', 'updated_at', 'is_published', 'view_count',
            'category', 'category_id',
            'tags', 'tag_ids',
            'can_view', 'can_edit', 'can_delete',
            'can_view_ids', 'can_edit_ids', 'can_delete_ids',
            'images', 'option_values', 'option_values_data',
            'versions_count', 'latest_version'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at', 'view_count']
    
    def get_latest_version(self, obj):
        latest = obj.versions.first()
        if latest:
            return ArticleVersionSerializer(latest).data
        return None
    
    def create(self, validated_data):
        option_values_data = validated_data.pop('option_values_data', [])
        validated_data['author'] = self.context['request'].user
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
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Article
        fields = ['id', 'title', 'summary', 'author', 'category', 'tags', 'created_at', 
                  'updated_at', 'is_published', 'view_count']


class GroupSerializer(serializers.ModelSerializer):
    """Сериализатор для групп пользователей"""
    users = UserSerializer(many=True, read_only=True)
    users_count = serializers.IntegerField(source='users.count', read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        source='users',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'users', 'user_ids', 'users_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CategoryPermissionSerializer(serializers.ModelSerializer):
    """Сериализатор для прав групп на категории"""
    group = serializers.StringRelatedField(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source='group',
        write_only=True
    )
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True
    )
    permission_level_display = serializers.CharField(source='get_permission_level_display', read_only=True)
    
    class Meta:
        model = CategoryPermission
        fields = ['id', 'group', 'group_id', 'category', 'category_id', 'permission_level', 
                  'permission_level_display', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class GroupDetailSerializer(serializers.ModelSerializer):
    """Детальный сериализатор группы с правами на категории"""
    users = UserSerializer(many=True, read_only=True)
    users_count = serializers.IntegerField(source='users.count', read_only=True)
    category_permissions = CategoryPermissionSerializer(many=True, read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        source='users',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'users', 'user_ids', 'users_count', 
                  'category_permissions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


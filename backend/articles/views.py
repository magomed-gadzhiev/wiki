from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, F
from django.db.models.functions import Lower
from django.utils import timezone
from .models import Article, ArticleVersion, ArticleImage, Category, Section, Tag, ArticleOption, ArticleOptionValue, Group, CategoryPermission
from .serializers import ArticleSerializer, ArticleListSerializer, ArticleVersionSerializer, ArticleImageSerializer, CategorySerializer, SectionSerializer, TagSerializer, ArticleOptionSerializer, ArticleOptionValueSerializer, GroupSerializer, GroupDetailSerializer, CategoryPermissionSerializer
from .permissions import ArticlePermission
import mammoth
import tempfile
import os
import base64
import zipfile
from bs4 import BeautifulSoup
try:
    import pypandoc
    PYPANDOC_AVAILABLE = True
except ImportError:
    PYPANDOC_AVAILABLE = False


class ArticleViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления статьями
    """
    queryset = Article.objects.all()
    permission_classes = [ArticlePermission]
    
    def _extract_images_from_docx(self, docx_path):
        """Извлекает изображения из DOCX файла и возвращает словарь {имя_файла: base64_data}"""
        images = {}
        try:
            with zipfile.ZipFile(docx_path, 'r') as docx_zip:
                # Изображения обычно находятся в word/media/
                for file_info in docx_zip.filelist:
                    if file_info.filename.startswith('word/media/'):
                        image_name = os.path.basename(file_info.filename)
                        image_data = docx_zip.read(file_info.filename)
                        
                        # Определяем MIME тип по расширению
                        ext = os.path.splitext(image_name)[1].lower()
                        mime_types = {
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.png': 'image/png',
                            '.gif': 'image/gif',
                            '.bmp': 'image/bmp',
                            '.webp': 'image/webp',
                            '.svg': 'image/svg+xml'
                        }
                        mime_type = mime_types.get(ext, 'image/png')
                        
                        # Конвертируем в base64
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        images[image_name] = {
                            'data': image_base64,
                            'mime_type': mime_type
                        }
        except Exception as e:
            pass  # Если не удалось извлечь, просто возвращаем пустой словарь
        return images
    
    def _convert_images_to_base64(self, html_content, docx_path):
        """Обрабатывает HTML и заменяет пути к изображениям на base64 data URI"""
        # Извлекаем изображения из DOCX
        images = self._extract_images_from_docx(docx_path)
        
        if not images:
            return html_content
        
        # Парсим HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Находим все теги img
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if not src:
                continue
            
            # Извлекаем имя файла из пути (может быть media/image1.jpeg или просто image1.jpeg)
            image_name = os.path.basename(src)
            
            # Убираем параметры запроса, если есть (например, ?width=100)
            if '?' in image_name:
                image_name = image_name.split('?')[0]
            
            # Ищем изображение в словаре
            matched = False
            if image_name in images:
                image_info = images[image_name]
                img['src'] = f"data:{image_info['mime_type']};base64,{image_info['data']}"
                matched = True
            else:
                # Пробуем найти по части имени (на случай если путь отличается)
                # Сначала пробуем точное совпадение без расширения
                image_name_no_ext = os.path.splitext(image_name)[0]
                for img_name, img_info in images.items():
                    img_name_no_ext = os.path.splitext(img_name)[0]
                    if image_name_no_ext.lower() == img_name_no_ext.lower():
                        img['src'] = f"data:{img_info['mime_type']};base64,{img_info['data']}"
                        matched = True
                        break
                
                # Если не нашли, пробуем частичное совпадение
                if not matched:
                    for img_name, img_info in images.items():
                        if image_name.lower() in img_name.lower() or img_name.lower() in image_name.lower():
                            img['src'] = f"data:{img_info['mime_type']};base64,{img_info['data']}"
                            matched = True
                            break
        
        return str(soup)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ArticleListSerializer
        return ArticleSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Article.objects.all()
        
        # Фильтрация по правам доступа
        if not user.is_superuser:
            # Получаем все группы пользователя
            user_groups = user.article_groups.all() if user.is_authenticated else Group.objects.none()
            
            # Получаем права групп на категории
            category_permissions = CategoryPermission.objects.filter(group__in=user_groups) if user_groups.exists() else CategoryPermission.objects.none()
            
            # Строим условия доступа
            access_conditions = Q(author=user)  # Автор всегда видит свои статьи
            
            # Если есть права через группы
            if category_permissions.exists():
                # Категории с полными правами - видим все статьи (включая черновики)
                full_permission_categories = category_permissions.filter(permission_level='full').values_list('category_id', flat=True)
                if full_permission_categories:
                    access_conditions |= Q(category_id__in=full_permission_categories)
                
                # Категории с правом только на чтение - видим только опубликованные
                read_permission_categories = category_permissions.filter(permission_level='read').values_list('category_id', flat=True)
                if read_permission_categories:
                    access_conditions |= Q(category_id__in=read_permission_categories, is_published=True)
                
                # Категории без прав или с правом 'none' - исключаем из доступа
                none_permission_categories = category_permissions.filter(permission_level='none').values_list('category_id', flat=True)
                
                # Статьи без категории или с категорией, на которую нет прав через группы
                # Используем старую логику доступа
                categories_with_permissions = category_permissions.values_list('category_id', flat=True).distinct()
                access_conditions |= Q(
                    Q(category__isnull=True) | ~Q(category_id__in=categories_with_permissions),
                    Q(is_published=True) | Q(can_view=user)
                )
            else:
                # Нет прав через группы, используем старую логику
                access_conditions |= Q(is_published=True) | Q(can_view=user)
            
            queryset = queryset.filter(access_conditions).distinct()
        
        # Поиск
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search) |
                Q(summary__icontains=search)
            )
        
        # Фильтр по автору
        author = self.request.query_params.get('author', None)
        if author:
            queryset = queryset.filter(author_id=author)
        
        # Фильтр по публикации
        is_published = self.request.query_params.get('is_published', None)
        if is_published is not None:
            queryset = queryset.filter(is_published=is_published.lower() == 'true')
        
        # Фильтр по категории
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Фильтр по тегам (можно передать несколько через tags=id1&tags=id2)
        tag_ids = self.request.query_params.getlist('tags')
        if tag_ids:
            queryset = queryset.filter(tags__id__in=tag_ids).distinct()
        
        # Фильтр по опциям статей (можно передать несколько через option_id[] и option_value[])
        option_ids = self.request.query_params.getlist('option_id')
        option_values = self.request.query_params.getlist('option_value')
        if option_ids and option_values and len(option_ids) == len(option_values):
            # Применяем фильтры по опциям (AND между разными опциями)
            import re
            for option_id, option_value in zip(option_ids, option_values):
                if option_id and option_value:
                    # Регистронезависимый поиск по значению опции (используем __iregex для SQLite с кириллицей)
                    # Экранируем специальные символы и добавляем .* для поиска подстроки
                    option_value_escaped = re.escape(option_value)
                    queryset = queryset.filter(
                        option_values__option_id=option_id,
                        option_values__value__iregex=f'.*{option_value_escaped}.*'
                    ).distinct()
        
        return queryset.select_related('author', 'category').prefetch_related(
            'can_view', 'can_edit', 'can_delete', 'tags', 'images', 'versions',
            'option_values__option'
        )
    
    def retrieve(self, request, *args, **kwargs):
        """Увеличиваем счетчик просмотров"""
        instance = self.get_object()
        Article.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Создание статьи с автоматическим созданием первой версии"""
        article = serializer.save()
        # Создаем первую версию
        ArticleVersion.objects.create(
            article=article,
            title=article.title,
            content=article.content,
            summary=article.summary,
            version_number=1,
            author=article.author,
            change_description='Создание статьи'
        )
    
    def perform_update(self, serializer):
        """Обновление статьи с созданием новой версии"""
        article = serializer.instance
        old_content = article.content
        old_title = article.title
        
        # Получаем change_description из request.data, если есть
        change_description = self.request.data.get('change_description', 'Обновление статьи')
        
        # Сохраняем изменения
        updated_article = serializer.save()
        
        # Создаем новую версию, если контент изменился
        if old_content != updated_article.content or old_title != updated_article.title:
            last_version = article.versions.first()
            new_version_number = (last_version.version_number + 1) if last_version else 1
            
            ArticleVersion.objects.create(
                article=updated_article,
                title=updated_article.title,
                content=updated_article.content,
                summary=updated_article.summary,
                version_number=new_version_number,
                author=self.request.user,
                change_description=change_description
            )
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Получить все версии статьи"""
        article = self.get_object()
        versions = article.versions.all()
        serializer = ArticleVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        """Восстановить статью из версии"""
        article = self.get_object()
        version_id = request.data.get('version_id')
        
        if not version_id:
            return Response(
                {'error': 'version_id обязателен'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            version = article.versions.get(id=version_id)
            article.title = version.title
            article.content = version.content
            article.summary = version.summary
            article.save()
            
            # Создаем новую версию с пометкой о восстановлении
            last_version = article.versions.first()
            new_version_number = (last_version.version_number + 1) if last_version else 1
            
            ArticleVersion.objects.create(
                article=article,
                title=article.title,
                content=article.content,
                summary=article.summary,
                version_number=new_version_number,
                author=request.user,
                change_description=f'Восстановление из версии {version.version_number}'
            )
            
            serializer = self.get_serializer(article)
            return Response(serializer.data)
        except ArticleVersion.DoesNotExist:
            return Response(
                {'error': 'Версия не найдена'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def upload_image(self, request, pk=None):
        """Загрузить изображение для статьи"""
        article = self.get_object()
        image_file = request.FILES.get('image')
        alt_text = request.data.get('alt_text', '')
        
        if not image_file:
            return Response(
                {'error': 'Изображение обязательно'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        article_image = ArticleImage.objects.create(
            article=article,
            image=image_file,
            alt_text=alt_text,
            uploaded_by=request.user
        )
        
        serializer = ArticleImageSerializer(article_image, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def import_word(self, request):
        """Импорт содержимого из Word документа с помощью Pandoc (fallback на mammoth)"""
        word_file = request.FILES.get('file')
        
        if not word_file:
            return Response(
                {'error': 'Файл обязателен'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        converter_used = None
        warnings = []
        
        # Пробуем использовать Pandoc
        if PYPANDOC_AVAILABLE:
            try:
                word_file.seek(0)
                # Сохраняем файл во временный файл для Pandoc
                with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp_file:
                    for chunk in word_file.chunks():
                        tmp_file.write(chunk)
                    tmp_file_path = tmp_file.name
                
                try:
                    # Конвертируем с помощью Pandoc
                    html_content = pypandoc.convert_file(
                        tmp_file_path,
                        'html',
                        format='docx',
                        extra_args=['--standalone', '--wrap=none']
                    )
                    
                    # Обрабатываем изображения и конвертируем в base64
                    html_content = self._convert_images_to_base64(html_content, tmp_file_path)
                    
                    converter_used = 'pandoc'
                finally:
                    # Удаляем временный файл
                    if os.path.exists(tmp_file_path):
                        os.unlink(tmp_file_path)
                
            except Exception as pandoc_error:
                # Если Pandoc не сработал, пробуем mammoth
                warnings.append(f'Pandoc не смог обработать файл: {str(pandoc_error)}. Используется fallback на mammoth.')
                converter_used = None
        
        # Fallback на mammoth, если Pandoc не доступен или не сработал
        if not converter_used:
            try:
                word_file.seek(0)
                import base64
                
                # Настраиваем mammoth для извлечения изображений
                def convert_image(image):
                    """Конвертирует изображение в base64"""
                    with image.open() as image_bytes:
                        image_data = image_bytes.read()
                        # Определяем MIME тип
                        content_type = image.content_type
                        if 'jpeg' in content_type or 'jpg' in content_type:
                            mime_type = 'image/jpeg'
                        elif 'png' in content_type:
                            mime_type = 'image/png'
                        elif 'gif' in content_type:
                            mime_type = 'image/gif'
                        elif 'webp' in content_type:
                            mime_type = 'image/webp'
                        else:
                            mime_type = 'image/png'
                        
                        # Конвертируем в base64
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        return {
                            "src": f"data:{mime_type};base64,{image_base64}"
                        }
                
                # Настраиваем style_map для обработки нераспознанных стилей
                style_map = """
                p[style-name='Intense Emphasis'] => em
                p[style-name='emphasis'] => em
                r[style-name='Intense Emphasis'] => em
                r[style-name='emphasis'] => em
                p[style-name='Strong'] => strong
                r[style-name='Strong'] => strong
                """
                
                # Используем mammoth для конвертации с обработкой изображений и стилей
                result = mammoth.convert_to_html(
                    word_file, 
                    convert_image=mammoth.images.img_element(convert_image),
                    style_map=style_map
                )
                html_content = result.value
                mammoth_messages = result.messages
                
                converter_used = 'mammoth'
                
                if mammoth_messages:
                    warnings.extend([str(m) for m in mammoth_messages])
                    
            except Exception as mammoth_error:
                return Response(
                    {'error': f'Ошибка при обработке файла: {str(mammoth_error)}'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response({
            'content': html_content,
            'warnings': warnings,
            'converter_used': converter_used
        })


class ArticleVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для просмотра версий статей
    """
    queryset = ArticleVersion.objects.all()
    serializer_class = ArticleVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = ArticleVersion.objects.all()
        article_id = self.request.query_params.get('article', None)
        if article_id:
            queryset = queryset.filter(article_id=article_id)
        return queryset.select_related('article', 'author')


class ArticleImageViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления изображениями статей
    """
    queryset = ArticleImage.objects.all()
    serializer_class = ArticleImageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = ArticleImage.objects.all()
        article_id = self.request.query_params.get('article', None)
        if article_id:
            queryset = queryset.filter(article_id=article_id)
        return queryset.select_related('article', 'uploaded_by')
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class SectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для просмотра разделов (только чтение, создание/редактирование через админку)
    """
    queryset = Section.objects.all().order_by('sort_order', 'name').prefetch_related('categories')
    serializer_class = SectionSerializer
    permission_classes = [permissions.AllowAny]  # Разделы доступны всем для просмотра


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для просмотра категорий (только чтение, создание/редактирование через админку)
    """
    queryset = Category.objects.all().order_by('section', 'sort_order', 'name').select_related('section')
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]  # Категории доступны всем для выбора


class TagViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления тегами
    """
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Tag.objects.all().order_by('name')
        # Поиск по названию (регистронезависимый для SQLite)
        search = self.request.query_params.get('search', None)
        if search:
            # В SQLite LOWER() не работает с кириллицей, используем COLLATE NOCASE
            # или фильтруем через Python. Используем __iregex для регистронезависимого поиска
            import re
            search_escaped = re.escape(search)
            queryset = queryset.filter(name__iregex=search_escaped)
        return queryset
    
    def create(self, request, *args, **kwargs):
        # Проверяем, существует ли уже тег с таким именем (без учета регистра)
        name = request.data.get('name', '').strip()
        if name:
            # Проверяем по имени (без учета регистра)
            existing_tag = Tag.objects.filter(name__iexact=name).first()
            if existing_tag:
                # Если тег существует, возвращаем его вместо создания нового
                serializer = self.get_serializer(existing_tag)
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            # Также проверяем по slug (на случай, если имя отличается, но slug одинаковый)
            from django.utils.text import slugify
            slug = slugify(name)
            existing_tag_by_slug = Tag.objects.filter(slug=slug).first()
            if existing_tag_by_slug:
                # Если тег с таким slug существует, возвращаем его
                serializer = self.get_serializer(existing_tag_by_slug)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Если тег не найден, создаем новый через стандартный метод
        return super().create(request, *args, **kwargs)


class ArticleOptionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для просмотра опций статей (только чтение, создание/редактирование через админку)
    """
    queryset = ArticleOption.objects.all().order_by('sort_order', 'name')
    serializer_class = ArticleOptionSerializer
    permission_classes = [permissions.AllowAny]  # Опции доступны всем для выбора


class GroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления группами пользователей
    """
    queryset = Group.objects.all().prefetch_related('users', 'category_permissions__category')
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer
    
    def get_queryset(self):
        queryset = Group.objects.all().prefetch_related('users', 'category_permissions__category')
        
        # Поиск по названию
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        # Фильтр по пользователю
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(users__id=user_id).distinct()
        
        return queryset.order_by('name')


class CategoryPermissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления правами групп на категории
    """
    queryset = CategoryPermission.objects.all().select_related('group', 'category')
    serializer_class = CategoryPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = CategoryPermission.objects.all().select_related('group', 'category')
        
        # Фильтр по группе
        group_id = self.request.query_params.get('group', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        
        # Фильтр по категории
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Фильтр по уровню прав
        permission_level = self.request.query_params.get('permission_level', None)
        if permission_level:
            queryset = queryset.filter(permission_level=permission_level)
        
        return queryset.order_by('group__name', 'category__name')


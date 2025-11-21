from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ArticleViewSet, ArticleVersionViewSet, ArticleImageViewSet, CategoryViewSet, SectionViewSet, TagViewSet, ArticleOptionViewSet, GroupViewSet, CategoryPermissionViewSet

router = DefaultRouter()
# Регистрируем специфичные роуты ПЕРЕД общим роутом статей
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'options', ArticleOptionViewSet, basename='article-option')
router.register(r'versions', ArticleVersionViewSet, basename='article-version')
router.register(r'images', ArticleImageViewSet, basename='article-image')
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'category-permissions', CategoryPermissionViewSet, basename='category-permission')
router.register(r'', ArticleViewSet, basename='article')

urlpatterns = [
    path('', include(router.urls)),
]


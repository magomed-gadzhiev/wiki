from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ArticleViewSet, ArticleVersionViewSet, ArticleImageViewSet, ElementViewSet, TechnologyViewSet, TagViewSet, ArticleOptionViewSet, GroupViewSet, ArticleTemplateViewSet, CommentViewSet

router = DefaultRouter()
# Регистрируем специфичные роуты ПЕРЕД общим роутом статей
router.register(r'technologies', TechnologyViewSet, basename='technology')
router.register(r'elements', ElementViewSet, basename='element')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'options', ArticleOptionViewSet, basename='article-option')
router.register(r'templates', ArticleTemplateViewSet, basename='article-template')
router.register(r'versions', ArticleVersionViewSet, basename='article-version')
router.register(r'images', ArticleImageViewSet, basename='article-image')
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'', ArticleViewSet, basename='article')

urlpatterns = [
    path('', include(router.urls)),
]


import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ArticleService } from '../../core/services/article.service';
import { Article, Technology, Category, Model } from '../../core/models/article.model';

export interface BreadcrumbItem {
  label: string;
  url: string | null;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent implements OnInit, OnDestroy {
  breadcrumbs: BreadcrumbItem[] = [];
  showBreadcrumbs = true;
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private articleService: ArticleService
  ) {}

  ngOnInit(): void {
    // Подписываемся на изменения маршрута
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateBreadcrumbs();
      });

    // Обновляем при первой загрузке
    this.updateBreadcrumbs();
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private updateBreadcrumbs(): void {
    const url = this.router.url;
    this.breadcrumbs = [];

    // Не показываем breadcrumbs на страницах логина/регистрации
    if (url.startsWith('/login') || url.startsWith('/register')) {
      this.showBreadcrumbs = false;
      return;
    }

    this.showBreadcrumbs = true;

    // Всегда добавляем главную страницу
    this.breadcrumbs.push({ label: 'Главная', url: '/articles' });

    // Разбираем URL и строим хлебные крошки
    if (url.startsWith('/articles')) {
      this.handleArticlesRoute(url);
    } else if (url.startsWith('/technologies')) {
      this.handleTechnologiesRoute(url);
    } else if (url.startsWith('/categories')) {
      this.handleCategoriesRoute(url);
    } else if (url.startsWith('/models')) {
      this.handleModelsRoute(url);
    } else if (url.startsWith('/change-password')) {
      this.breadcrumbs.push({ label: 'Смена пароля', url: null });
    }
  }

  private handleArticlesRoute(url: string): void {
    // /articles - список статей
    if (url === '/articles' || url === '/articles/') {
      // На главной странице показываем только "Главная"
      return;
    }

    // /articles/new - создание статьи
    if (url === '/articles/new') {
      this.breadcrumbs.push({ label: 'Создание статьи', url: null });
      return;
    }

    // /articles/:id - просмотр статьи
    const articleIdMatch = url.match(/^\/articles\/([^\/]+)$/);
    if (articleIdMatch) {
      const articleId = articleIdMatch[1];
      this.loadArticleBreadcrumbs(articleId);
      return;
    }

    // /articles/:id/edit - редактирование статьи
    const editMatch = url.match(/^\/articles\/([^\/]+)\/edit$/);
    if (editMatch) {
      const articleId = editMatch[1];
      this.loadArticleBreadcrumbs(articleId, true);
      return;
    }

    // /articles/:id/versions - версии статьи
    const versionsMatch = url.match(/^\/articles\/([^\/]+)\/versions$/);
    if (versionsMatch) {
      const articleId = versionsMatch[1];
      this.loadArticleBreadcrumbs(articleId);
      this.breadcrumbs.push({ label: 'История версий', url: null });
      return;
    }
  }

  private handleTechnologiesRoute(url: string): void {
    const match = url.match(/^\/technologies\/([^\/]+)$/);
    if (match) {
      const technologyId = match[1];
      this.loadTechnologyBreadcrumbs(technologyId);
    }
  }

  private handleCategoriesRoute(url: string): void {
    // /categories/:id - статьи категории
    const categoryMatch = url.match(/^\/categories\/([^\/]+)$/);
    if (categoryMatch) {
      const categoryId = categoryMatch[1];
      this.loadCategoryBreadcrumbs(categoryId);
      return;
    }

    // /categories/:id/articles/new - создание статьи из категории
    const newArticleMatch = url.match(/^\/categories\/([^\/]+)\/articles\/new$/);
    if (newArticleMatch) {
      const categoryId = newArticleMatch[1];
      this.loadCategoryBreadcrumbs(categoryId);
      this.breadcrumbs.push({ label: 'Создание статьи', url: null });
      return;
    }
  }

  private handleModelsRoute(url: string): void {
    const match = url.match(/^\/models\/([^\/]+)$/);
    if (match) {
      const modelId = match[1];
      this.loadModelBreadcrumbs(modelId);
    }
  }

  private loadArticleBreadcrumbs(articleId: string, isEdit: boolean = false): void {
    this.articleService.getArticle(articleId).subscribe({
      next: (article: Article) => {
        this.buildBreadcrumbsFromArticle(article, isEdit);
      },
      error: () => {
        // В случае ошибки просто добавляем ID статьи
        this.breadcrumbs.push({ label: `Статья ${articleId}`, url: null });
        if (isEdit) {
          this.breadcrumbs.push({ label: 'Редактирование', url: null });
        }
      }
    });
  }

  private buildBreadcrumbsFromArticle(article: Article, isEdit: boolean = false): void {
    if (article.model?.category?.technology) {
      this.breadcrumbs.push({
        label: article.model.category.technology.name,
        url: `/technologies/${article.model.category.technology.id}`
      });
    }

    if (article.model?.category) {
      this.breadcrumbs.push({
        label: article.model.category.name,
        url: `/categories/${article.model.category.id}`
      });
    }

    if (article.model) {
      this.breadcrumbs.push({
        label: article.model.name,
        url: `/models/${article.model.id}`
      });
    }

    this.breadcrumbs.push({
      label: article.model_name,
      url: isEdit ? null : `/articles/${article.id}`
    });

    if (isEdit) {
      this.breadcrumbs.push({ label: 'Редактирование', url: null });
    }
  }

  private loadTechnologyBreadcrumbs(technologyId: string): void {
    this.articleService.getTechnology(technologyId).subscribe({
      next: (technology: Technology) => {
        this.breadcrumbs.push({
          label: technology.name,
          url: null
        });
      },
      error: () => {
        this.breadcrumbs.push({ label: `Технология ${technologyId}`, url: null });
      }
    });
  }

  private loadCategoryBreadcrumbs(categoryId: string): void {
    this.articleService.getCategory(categoryId).subscribe({
      next: (category: Category) => {
        if (category.technology) {
          this.breadcrumbs.push({
            label: category.technology.name,
            url: `/technologies/${category.technology.id}`
          });
        }
        this.breadcrumbs.push({
          label: category.name,
          url: null
        });
      },
      error: () => {
        this.breadcrumbs.push({ label: `Категория ${categoryId}`, url: null });
      }
    });
  }

  private loadModelBreadcrumbs(modelId: string): void {
    this.articleService.getModel(modelId).subscribe({
      next: (model: Model) => {
        if (model.category?.technology) {
          this.breadcrumbs.push({
            label: model.category.technology.name,
            url: `/technologies/${model.category.technology.id}`
          });
        }
        if (model.category) {
          this.breadcrumbs.push({
            label: model.category.name,
            url: `/categories/${model.category.id}`
          });
        }
        this.breadcrumbs.push({
          label: model.name,
          url: null
        });
      },
      error: () => {
        this.breadcrumbs.push({ label: `Модель ${modelId}`, url: null });
      }
    });
  }
}


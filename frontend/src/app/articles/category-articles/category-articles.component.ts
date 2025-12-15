import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ArticleService } from '../../core/services/article.service';
import { Article, Category, Model } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import { ArticleFiltersComponent } from '../shared/article-filters.component';

@Component({
  selector: 'app-category-articles',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ArticleFiltersComponent],
  templateUrl: './category-articles.component.html',
  styleUrls: ['./category-articles.component.scss']
})
export class CategoryArticlesComponent implements OnInit {
  articles: Article[] = [];
  category: Category | null = null;
  categoryId: string | null = null;
  models: Model[] = [];
  loading = false;
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';
  private searchTimeout: any;
  
  // Фильтры
  selectedTagIds: string[] = [];
  selectedOptionFilters: { option_id: string; option_value: string }[] = [];

  constructor(
    private articleService: ArticleService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.categoryId = params.get('id');
      if (this.categoryId) {
        this.loadCategory();
        this.loadArticles();
      }
    });
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  loadCategory(): void {
    this.articleService.getCategories().subscribe({
      next: (categories) => {
        this.category = categories.find(c => c.id === this.categoryId) || null;
      },
      error: () => {
        // Ошибка загрузки категории
      }
    });
  }

  loadArticles(): void {
    if (!this.categoryId) return;
    
    this.loading = true;
    
    // Получаем модели категории через фильтрацию на бэкенде
    this.articleService.getModels({ category: this.categoryId }).subscribe({
      next: (models) => {
        // Сохраняем модели для навигации
        this.models = models.sort((a, b) => a.sort_order - b.sort_order);
        const modelIds = models.map(m => m.id);
        
        if (modelIds.length === 0) {
          this.articles = [];
          this.loading = false;
          return;
        }
        
        // Загружаем статьи для всех моделей категории
        const params: any = { 
          search: this.searchQuery || undefined
        };
        
        // Добавляем фильтры по тегам
        if (this.selectedTagIds.length > 0) {
          params.tags = this.selectedTagIds;
        }
        
        // Добавляем фильтры по опциям
        if (this.selectedOptionFilters.length > 0) {
          params.optionFilters = this.selectedOptionFilters.filter(f => f.option_value && f.option_value.trim());
        }
        
        // Загружаем статьи для каждой модели и объединяем результаты
        const articleRequests = modelIds.map(modelId => {
          const modelParams = { ...params, model: modelId };
          return this.articleService.getArticles(modelParams).pipe(
            map(response => response.results)
          );
        });
        
        forkJoin(articleRequests).subscribe({
          next: (articlesArrays) => {
            // Объединяем все статьи в один массив
            this.articles = articlesArrays.flat();
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.articles = [];
          }
        });
      },
      error: () => {
        this.loading = false;
        this.articles = [];
        this.models = [];
      }
    });
  }
  
  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadArticles();
    }, 500);
  }
  
  onFilterChange(): void {
    this.loadArticles();
  }
}


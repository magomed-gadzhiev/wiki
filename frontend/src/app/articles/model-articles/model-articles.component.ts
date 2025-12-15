import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Article, Model } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import { ArticleFiltersComponent } from '../shared/article-filters.component';

@Component({
  selector: 'app-model-articles',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ArticleFiltersComponent],
  templateUrl: './model-articles.component.html',
  styleUrls: ['./model-articles.component.scss']
})
export class ModelArticlesComponent implements OnInit {
  articles: Article[] = [];
  model: Model | null = null;
  modelId: string | null = null;
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
      this.modelId = params.get('id');
      if (this.modelId) {
        this.loadModel();
        this.loadArticles();
      }
    });
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  loadModel(): void {
    this.articleService.getModels().subscribe({
      next: (models) => {
        this.model = models.find(m => m.id === this.modelId) || null;
      },
      error: () => {
        // Ошибка загрузки модели
      }
    });
  }

  loadArticles(): void {
    if (!this.modelId) return;
    
    this.loading = true;
    
    const params: any = { 
      model: this.modelId,
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
    
    this.articleService.getArticles(params).subscribe({
      next: (response) => {
        this.articles = response.results || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.articles = [];
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


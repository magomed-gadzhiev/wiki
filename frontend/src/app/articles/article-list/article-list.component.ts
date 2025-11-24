import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Article } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import { ArticleFiltersComponent } from '../shared/article-filters.component';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ArticleFiltersComponent],
  template: `
    <div class="container">
      <div class="article-list-header">
        <h1>Статьи</h1>
        <div class="actions">
          <input 
            type="text" 
            placeholder="Поиск..." 
            [(ngModel)]="searchQuery"
            (input)="onSearch()"
            class="search-input"
          />
          <div class="view-toggle">
            <button 
              class="view-btn" 
              [class.active]="viewMode === 'grid'"
              (click)="viewMode = 'grid'"
              title="Плитка"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
              </svg>
            </button>
            <button 
              class="view-btn" 
              [class.active]="viewMode === 'list'"
              (click)="viewMode = 'list'"
              title="Список"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="16" height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="15" width="16" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <a *ngIf="isAuthenticated()" routerLink="/articles/new" class="btn btn-primary">
            Новая статья
          </a>
        </div>
      </div>
      
      <app-article-filters
        [selectedTagIds]="selectedTagIds"
        [selectedOptionFilters]="selectedOptionFilters"
        (tagIdsChange)="selectedTagIds = $event"
        (optionFiltersChange)="selectedOptionFilters = $event"
        (filterChange)="onFilterChange()"
      ></app-article-filters>
      
      <div *ngIf="loading" class="loading">Загрузка...</div>
      
      <div *ngIf="!loading && articles.length === 0" class="empty-state">
        <p>Статьи не найдены</p>
      </div>
      
      <div 
        [class.article-grid]="viewMode === 'grid'"
        [class.article-list]="viewMode === 'list'"
        *ngIf="!loading && articles.length > 0"
      >
        <div class="card article-card" *ngFor="let article of articles">
          <div class="article-header">
            <h3>
              <a [routerLink]="['/articles', article.id]">{{ article.title }}</a>
            </h3>
            <div class="article-status">
              <span *ngIf="article.category" class="tag category-tag">{{ article.category.name }}</span>
              <span *ngIf="article.is_published" class="tag published">Опубликовано</span>
              <span *ngIf="!article.is_published" class="tag draft">Черновик</span>
            </div>
          </div>
          <p class="summary">{{ article.summary || 'Нет описания' }}</p>
          <div class="article-meta">
            <span class="author">{{ article.author.username }}</span>
            <span class="date">{{ article.updated_at | date:'dd.MM.yyyy, HH:mm' }}</span>
            <span class="views">{{ article.view_count }}</span>
          </div>
          <div class="article-tags" *ngIf="article.tags && article.tags.length > 0">
            <span *ngFor="let tag of article.tags" class="badge bg-primary tag-badge">{{ tag.name }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .article-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    .actions {
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .view-toggle {
      display: flex;
      gap: 5px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 2px;
      background-color: #f8f9fa;
    }
    .view-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 3px;
      color: #666;
      transition: all 0.2s;
    }
    .view-btn:hover {
      background-color: #e9ecef;
      color: #333;
    }
    .view-btn.active {
      background-color: #007bff;
      color: white;
    }
    .view-btn svg {
      display: block;
    }
    .search-input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .article-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .article-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .article-list .article-card {
      display: flex;
      flex-direction: column;
      padding: 12px;
    }
    .article-list .article-card .article-header {
      margin-bottom: 6px;
    }
    .article-list .article-card .summary {
      margin-bottom: 6px;
      -webkit-line-clamp: 1;
    }
    .article-list .article-card .article-meta {
      margin-bottom: 6px;
    }
    .article-list .article-card .article-tags {
      margin-top: 4px;
    }
    .article-card {
      display: flex;
      flex-direction: column;
      padding: 12px;
    }
    .article-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .article-card h3 {
      margin: 0;
      flex: 1;
      font-size: 16px;
      line-height: 1.3;
    }
    .article-card h3 a {
      text-decoration: none;
      color: #007bff;
    }
    .article-card h3 a:hover {
      text-decoration: underline;
    }
    .article-status {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .summary {
      color: #666;
      margin-bottom: 8px;
      font-size: 13px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .article-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #999;
      margin-bottom: 8px;
    }
    .article-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .tag {
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
    }
    .tag.published {
      background-color: #d4edda;
      color: #155724;
    }
    .tag.draft {
      background-color: #fff3cd;
      color: #856404;
    }
    .tag.category-tag {
      background-color: #e7f3ff;
      color: #0066cc;
    }
    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.35em 0.65em;
      font-size: 0.875em;
      font-weight: 500;
    }
    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
  `]
})
export class ArticleListComponent implements OnInit {
  articles: Article[] = [];
  loading = false;
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';
  private searchTimeout: any;
  
  // Фильтры
  selectedTagIds: string[] = [];
  selectedOptionFilters: { option_id: string; option_value: string }[] = [];

  constructor(
    private articleService: ArticleService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadArticles();
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  loadArticles(): void {
    this.loading = true;
    const params: any = { search: this.searchQuery || undefined };
    
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
        this.articles = response.results;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
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


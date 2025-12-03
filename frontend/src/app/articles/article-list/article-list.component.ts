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
  templateUrl: './article-list.component.html',
  styleUrls: ['./article-list.component.scss']
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


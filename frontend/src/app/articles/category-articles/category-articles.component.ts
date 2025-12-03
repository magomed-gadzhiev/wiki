import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Article, Element } from '../../core/models/article.model';
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
  element: Element | null = null;
  elementId: string | null = null;
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
      this.elementId = params.get('id');
      if (this.elementId) {
        this.loadElement();
        this.loadArticles();
      }
    });
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  loadElement(): void {
    this.articleService.getElements().subscribe({
      next: (elements) => {
        this.element = elements.find(e => e.id === this.elementId) || null;
      },
      error: () => {
        // Ошибка загрузки элемента
      }
    });
  }

  loadArticles(): void {
    if (!this.elementId) return;
    
    this.loading = true;
    const params: any = { 
      element: this.elementId,
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


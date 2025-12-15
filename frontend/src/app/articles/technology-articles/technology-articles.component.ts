import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { Technology, Category, Article } from '../../core/models/article.model';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-technology-articles',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './technology-articles.component.html',
  styleUrls: ['./technology-articles.component.scss']
})
export class TechnologyArticlesComponent implements OnInit {
  technology: Technology | null = null;
  technologyId: string | null = null;
  articles: Article[] = [];
  loading = false;
  loadingArticles = false;

  constructor(
    private articleService: ArticleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.technologyId = params.get('id');
      if (this.technologyId) {
        this.loadTechnology();
      }
    });
  }

  loadTechnology(): void {
    this.loading = true;
    this.articleService.getTechnologies().subscribe({
      next: (technologies) => {
        this.technology = technologies.find(t => t.id === this.technologyId) || null;
        this.loading = false;
        if (this.technology) {
          this.loadArticles();
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadArticles(): void {
    if (!this.technology || !this.technology.categories || this.technology.categories.length === 0) {
      this.articles = [];
      return;
    }

    this.loadingArticles = true;
    
    // Загружаем статьи для всех категорий технологии через модели
    // Получаем модели для каждой категории параллельно
    const categoryIds = this.technology.categories.map(c => c.id);
    const modelRequests = categoryIds.map(categoryId =>
      this.articleService.getModels({ category: categoryId }).pipe(
        map(models => models),
        catchError(() => of([]))
      )
    );

    if (modelRequests.length === 0) {
      this.articles = [];
      this.loadingArticles = false;
      return;
    }

    forkJoin(modelRequests).subscribe({
      next: (modelsArrays) => {
        // Объединяем все модели в один массив
        const allModels = modelsArrays.flat();
        
        if (allModels.length === 0) {
          this.articles = [];
          this.loadingArticles = false;
          return;
        }
        
        // Загружаем статьи для всех моделей параллельно
        const articleRequests = allModels.map(model =>
          this.articleService.getArticles({ model: model.id }).pipe(
            map(response => response.results),
            catchError(() => of([]))
          )
        );

        forkJoin(articleRequests).subscribe({
          next: (articlesArrays) => {
            // Объединяем все статьи в один массив
            this.articles = articlesArrays.flat();
            this.loadingArticles = false;
          },
          error: () => {
            this.loadingArticles = false;
            this.articles = [];
          }
        });
      },
      error: () => {
        this.loadingArticles = false;
        this.articles = [];
      }
    });
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { Technology, Element, Article } from '../../core/models/article.model';
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
    if (!this.technology || !this.technology.elements || this.technology.elements.length === 0) {
      this.articles = [];
      return;
    }

    this.loadingArticles = true;
    
    // Загружаем статьи для всех элементов технологии параллельно
    const articleRequests = this.technology.elements.map(element =>
      this.articleService.getArticles({ element: element.id }).pipe(
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
  }
}


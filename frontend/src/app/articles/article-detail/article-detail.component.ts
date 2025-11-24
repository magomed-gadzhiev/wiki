import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleService } from '../../core/services/article.service';
import { Article } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container" *ngIf="article">
      <div class="article-header">
        <h1>{{ article.title }}</h1>
        <div class="article-actions" *ngIf="canEdit()">
          <a [routerLink]="['/articles', article.id, 'edit']" class="btn btn-primary">Редактировать</a>
          <button *ngIf="canDelete()" class="btn btn-danger" (click)="deleteArticle()">Удалить</button>
        </div>
      </div>
      
      <div class="article-tags" *ngIf="article.tags && article.tags.length > 0">
        <span *ngFor="let tag of article.tags" class="badge bg-primary tag-badge">{{ tag.name }}</span>
      </div>
      
      <div class="article-meta">
        <span>Автор: {{ article.author.username }}</span>
        <span *ngIf="article.category">Категория: {{ article.category.name }}</span>
        <span>Создано: {{ article.created_at | date:'dd.MM.yyyy, HH:mm' }}</span>
        <span>Обновлено: {{ article.updated_at | date:'dd.MM.yyyy, HH:mm' }}</span>
        <span>Просмотров: {{ article.view_count }}</span>
        <a *ngIf="isAuthenticated()" [routerLink]="['/articles', article.id, 'versions']">История версий</a>
      </div>
      
      <div class="card article-content">
        <div #articleContent class="article-content-wrapper" [innerHTML]="sanitizedContent"></div>
      </div>
      
      <div class="card article-options" *ngIf="article.option_values && article.option_values.length > 0">
        <h2>Опции статьи</h2>
        <table class="table table-bordered">
          <thead>
            <tr>
              <th>Опция</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let optionValue of article.option_values">
              <td>
                <strong>{{ optionValue.option.name }}</strong>
                <span *ngIf="optionValue.option.description" class="option-description"> - {{ optionValue.option.description }}</span>
              </td>
              <td>{{ optionValue.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="card article-attachments" *ngIf="article.attachments && article.attachments.length > 0">
        <h2>Вложения</h2>
        <div class="attachments-list">
          <div class="attachment-item" *ngFor="let attachment of article.attachments">
            <div class="attachment-info">
              <a [href]="attachment.file_url" target="_blank" class="attachment-link">
                <span class="attachment-icon">📎</span>
                <span class="attachment-filename">{{ attachment.filename }}</span>
              </a>
              <div class="attachment-meta">
                <span class="attachment-size">{{ attachment.file_size_display }}</span>
                <span class="attachment-date">{{ attachment.uploaded_at | date:'dd.MM.yyyy, HH:mm' }}</span>
                <span class="attachment-uploader">Загрузил: {{ attachment.uploaded_by_username }}</span>
              </div>
              <div class="attachment-comment" *ngIf="attachment.comment">
                <strong>Комментарий:</strong> {{ attachment.comment }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div *ngIf="loading" class="loading">Загрузка...</div>
    <div *ngIf="error" class="error">{{ error }}</div>
  `,
  styles: [`
    .article-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .article-actions {
      display: flex;
      gap: 10px;
    }
    .article-meta {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #666;
    }
    .article-meta a {
      color: #007bff;
      text-decoration: none;
    }
    .article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.35em 0.65em;
      font-size: 0.875em;
      font-weight: 500;
    }
    .article-content {
      margin-bottom: 30px;
    }
    .article-options {
      margin-top: 30px;
    }
    .article-options h2 {
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    .article-options .table {
      margin-bottom: 0;
    }
    .article-options .table th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .option-description {
      color: #666;
      font-weight: normal;
      font-size: 0.9em;
    }
    .article-attachments {
      margin-top: 30px;
    }
    .article-attachments h2 {
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .attachment-item {
      padding: 15px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background-color: #f8f9fa;
    }
    .attachment-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .attachment-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
      font-size: 1.1em;
    }
    .attachment-link:hover {
      text-decoration: underline;
    }
    .attachment-icon {
      font-size: 1.2em;
    }
    .attachment-meta {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #666;
    }
    .attachment-comment {
      margin-top: 8px;
      padding: 8px;
      background-color: #ffffff;
      border-left: 3px solid #007bff;
      font-size: 0.95em;
    }
    .article-content ::ng-deep img {
      max-width: 100%;
      height: auto;
    }
    .article-content ::ng-deep table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .article-content ::ng-deep table th,
    .article-content ::ng-deep table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .article-content ::ng-deep table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .loading, .error {
      text-align: center;
      padding: 40px;
    }
    .error {
      color: #dc3545;
    }
  `]
})
export class ArticleDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef;
  
  article: Article | null = null;
  loading = false;
  error: string | null = null;
  sanitizedContent: SafeHtml = '';
  private styleElement: HTMLStyleElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadArticle(id);
    }
  }

  ngAfterViewInit(): void {
    // Убеждаемся, что стили применены после инициализации представления
    // Это нужно, если статья загрузилась до инициализации представления
    if (this.article && this.article.content && !this.styleElement) {
      setTimeout(() => {
        const styleMatch = this.article!.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch && styleMatch[1]) {
          const cssText = styleMatch[1].trim();
          if (cssText) {
            this.addArticleStyles(cssText);
          }
        }
      }, 100);
    }
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  canEdit(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.article.author.id === user.id || 
           this.article.can_edit.some(u => u.id === user.id) ||
           (user.is_staff ?? false);
  }

  canDelete(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.article.author.id === user.id || 
           this.article.can_delete.some(u => u.id === user.id) ||
           (user.is_staff ?? false);
  }

  loadArticle(id: string): void {
    this.loading = true;
    this.error = null;
    
    this.articleService.getArticle(id).subscribe({
      next: (article) => {
        this.article = article;
        this.processArticleContent(article.content);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка загрузки статьи';
        this.loading = false;
      }
    });
  }

  processArticleContent(content: string): void {
    // Удаляем старые стили, если они есть
    this.removeArticleStyles();
    
    // Извлекаем стили из контента
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    let cssText = '';
    
    if (styleMatch && styleMatch[1]) {
      cssText = styleMatch[1].trim();
    }
    
    // Убираем теги style из HTML для отображения
    const htmlWithoutStyles = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    
    // Используем DomSanitizer для безопасного встраивания HTML
    this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(htmlWithoutStyles);
    
    // Добавляем стили в документ, если они есть
    if (cssText) {
      // Применяем стили с небольшой задержкой, чтобы DOM был готов
      setTimeout(() => {
        this.addArticleStyles(cssText);
      }, 50);
    }
  }

  addArticleStyles(cssText: string): void {
    // Удаляем старые стили
    this.removeArticleStyles();
    
    // Просто добавляем стили как есть - они должны применяться глобально
    // Если нужна изоляция, можно обернуть в .article-content-wrapper
    // Но для начала попробуем без обертки
    
    // Создаем новый элемент style
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'article-content-styles';
    this.styleElement.textContent = cssText;
    document.head.appendChild(this.styleElement);
    
  }

  removeArticleStyles(): void {
    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    } else {
      // Также проверяем, есть ли стили в head
      const existingStyle = document.getElementById('article-content-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    }
  }

  ngOnDestroy(): void {
    // Очищаем стили при уничтожении компонента
    this.removeArticleStyles();
  }

  deleteArticle(): void {
    if (!this.article || !confirm('Вы уверены, что хотите удалить эту статью?')) {
      return;
    }
    
    this.articleService.deleteArticle(this.article.id).subscribe({
      next: () => {
        this.router.navigate(['/articles']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка удаления статьи';
      }
    });
  }
}


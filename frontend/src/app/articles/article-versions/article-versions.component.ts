import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { ArticleVersion } from '../../core/models/article.model';

@Component({
  selector: 'app-article-versions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <h1>История версий статьи</h1>
      <a [routerLink]="['/articles', articleId]" class="btn btn-secondary">Назад к статье</a>
      
      <div *ngIf="loading" class="loading">Загрузка...</div>
      
      <div *ngIf="!loading && versions.length === 0" class="empty-state">
        <p>Версии не найдены</p>
      </div>
      
      <div class="versions-list" *ngIf="!loading && versions.length > 0">
        <div class="card version-card" *ngFor="let version of versions">
          <div class="version-header">
            <h3>Версия {{ version.version_number }}</h3>
            <div class="version-meta">
              <span>Автор: {{ version.author.username }}</span>
              <span>{{ version.created_at | date:'short' }}</span>
            </div>
          </div>
          
          <div class="version-description" *ngIf="version.change_description">
            <strong>Описание изменений:</strong> {{ version.change_description }}
          </div>
          
          <div class="version-content-toggle">
            <button 
              class="toggle-btn" 
              (click)="toggleContent(version.id)"
              type="button">
              <span *ngIf="!isExpanded(version.id)">▼</span>
              <span *ngIf="isExpanded(version.id)">▲</span>
              {{ isExpanded(version.id) ? 'Свернуть содержимое' : 'Развернуть содержимое' }}
            </button>
          </div>
          
          <div class="version-content" *ngIf="isExpanded(version.id)">
            <h4>{{ version.title }}</h4>
            <div [innerHTML]="getSanitizedContent(version.content)"></div>
          </div>
          
          <div class="version-actions">
            <button class="btn btn-primary" (click)="restoreVersion(version.id)">
              Восстановить эту версию
            </button>
          </div>
        </div>
      </div>
      
      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .versions-list {
      margin-top: 20px;
    }
    .version-card {
      margin-bottom: 20px;
    }
    .version-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .version-meta {
      display: flex;
      gap: 15px;
      font-size: 14px;
      color: #666;
    }
    .version-description {
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    .version-content-toggle {
      margin-bottom: 10px;
    }
    .toggle-btn {
      padding: 5px 10px;
      background: none;
      border: none;
      color: #007bff;
      cursor: pointer;
      text-decoration: none;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .toggle-btn:hover {
      text-decoration: underline;
    }
    .version-content {
      margin-bottom: 15px;
      padding: 15px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }
    .version-content ::ng-deep img {
      max-width: 100%;
      height: auto;
    }
    .version-actions {
      margin-top: 15px;
    }
    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .error {
      color: #dc3545;
      margin-top: 20px;
    }
  `]
})
export class ArticleVersionsComponent implements OnInit, OnDestroy {
  versions: ArticleVersion[] = [];
  articleId: string | null = null;
  loading = false;
  error: string | null = null;
  expandedVersions: Set<string> = new Set();
  private versionStyles: Map<string, HTMLStyleElement> = new Map();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');
    if (this.articleId) {
      this.loadVersions();
    }
  }

  loadVersions(): void {
    if (!this.articleId) return;
    
    this.loading = true;
    this.articleService.getVersions(this.articleId).subscribe({
      next: (versions) => {
        this.versions = versions;
        this.loading = false;
      },
      error: (err) => {
        if (err.status === 403) {
          this.error = err.error?.error || 'У вас нет прав на просмотр истории версий. Доступно только чтение статей.';
          // Перенаправляем на страницу статьи через 3 секунды
          setTimeout(() => {
            if (this.articleId) {
              this.router.navigate(['/articles', this.articleId]);
            }
          }, 3000);
        } else {
          this.error = err.error?.error || 'Ошибка загрузки версий';
        }
        this.loading = false;
      }
    });
  }

  restoreVersion(versionId: string): void {
    if (!this.articleId || !confirm('Вы уверены, что хотите восстановить эту версию? Текущая версия будет сохранена как новая.')) {
      return;
    }
    
    this.articleService.restoreVersion(this.articleId, versionId).subscribe({
      next: (article) => {
        this.router.navigate(['/articles', article.id]);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка восстановления версии';
      }
    });
  }

  toggleContent(versionId: string): void {
    if (this.expandedVersions.has(versionId)) {
      this.expandedVersions.delete(versionId);
    } else {
      this.expandedVersions.add(versionId);
    }
    // Принудительно обновляем представление
    this.cdr.markForCheck();
  }

  isExpanded(versionId: string): boolean {
    return this.expandedVersions.has(versionId);
  }

  getSanitizedContent(content: string): string {
    // Извлекаем стили из контента
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    let cssText = '';
    
    if (styleMatch && styleMatch[1]) {
      cssText = styleMatch[1].trim();
    }
    
    // Если есть стили, добавляем их в документ
    if (cssText) {
      this.addVersionStyles(content, cssText);
    }
    
    // Убираем теги style из HTML для отображения
    return content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
  }

  addVersionStyles(content: string, cssText: string): void {
    // Создаем уникальный ID на основе хеша контента
    const versionId = this.hashCode(content);
    const styleId = `version-styles-${versionId}`;
    
    // Удаляем старые стили для этой версии, если они есть
    this.removeVersionStyles(versionId);
    
    // Создаем новый элемент style
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);
    
    // Сохраняем ссылку для последующего удаления
    this.versionStyles.set(versionId, styleElement);
  }

  removeVersionStyles(versionId: string): void {
    const styleElement = this.versionStyles.get(versionId);
    if (styleElement && document.head.contains(styleElement)) {
      document.head.removeChild(styleElement);
      this.versionStyles.delete(versionId);
    }
  }

  hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  ngOnDestroy(): void {
    // Очищаем все стили версий при уничтожении компонента
    this.versionStyles.forEach((styleElement) => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    });
    this.versionStyles.clear();
  }
}


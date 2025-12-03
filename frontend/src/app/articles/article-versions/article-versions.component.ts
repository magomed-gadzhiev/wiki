import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { ArticleVersion } from '../../core/models/article.model';

@Component({
  selector: 'app-article-versions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './article-versions.component.html',
  styleUrls: ['./article-versions.component.scss']
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


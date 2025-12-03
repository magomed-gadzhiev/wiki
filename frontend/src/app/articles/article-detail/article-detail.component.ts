import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleService } from '../../core/services/article.service';
import { Article } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import { ArticleCommentsComponent } from '../article-comments/article-comments.component';
import { ArticleTocComponent } from '../article-toc/article-toc.component';

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleCommentsComponent, ArticleTocComponent],
  templateUrl: './article-detail.component.html',
  styleUrls: ['./article-detail.component.scss']
})
export class ArticleDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef<HTMLDivElement>;
  
  article: Article | null = null;
  loading = false;
  error: string | null = null;
  sanitizedContent: SafeHtml = '';
  private styleElement: HTMLStyleElement | null = null;

  get contentElement(): HTMLElement | null {
    return this.articleContent?.nativeElement || null;
  }

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
    
    // Добавляем ID к заголовкам после рендеринга
    if (this.articleContent) {
      setTimeout(() => {
        this.addIdsToHeadingsInDOM();
      }, 200);
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

  canViewVersions(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    
    // Суперпользователи и авторы имеют доступ
    if (this.article.author.id === user.id || (user.is_staff ?? false)) {
      return true;
    }
    
    // Права проверяются на уровне API, здесь просто проверяем индивидуальные права
    // Если есть права на редактирование, значит можно просматривать версии
    return this.article.can_edit.some(u => u.id === user.id);
  }

  loadArticle(id: string): void {
    this.loading = true;
    this.error = null;
    
    this.articleService.getArticle(id).subscribe({
      next: (article) => {
        this.article = article;
        this.processArticleContent(article.content);
        this.loading = false;
        
        // Добавляем ID к заголовкам после загрузки контента
        setTimeout(() => {
          this.addIdsToHeadingsInDOM();
        }, 300);
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
    let htmlWithoutStyles = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    
    // Добавляем ID к заголовкам для навигации
    htmlWithoutStyles = this.addIdsToHeadings(htmlWithoutStyles);
    
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

  addIdsToHeadings(html: string): string {
    // Просто возвращаем HTML как есть, ID будут добавлены в DOM
    return html;
  }

  addIdsToHeadingsInDOM(): void {
    if (!this.articleContent?.nativeElement) return;
    
    const headings = this.articleContent.nativeElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let index = 0;
    
    headings.forEach((heading) => {
      const htmlHeading = heading as HTMLElement;
      if (!htmlHeading.id) {
        const text = htmlHeading.textContent?.trim() || '';
        if (text) {
          const id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9а-яё]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)}`;
          htmlHeading.id = id;
          index++;
        }
      }
    });
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


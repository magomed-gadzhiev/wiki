import { Component, Input, OnInit, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TocItem {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
}

@Component({
  selector: 'app-article-toc',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article-toc.component.html',
  styleUrls: ['./article-toc.component.scss']
})
export class ArticleTocComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() contentElement!: HTMLElement;
  @Input() commentsElementId: string = 'article-comments';
  
  tocItems: TocItem[] = [];
  activeItemId: string | null = null;
  private observer: IntersectionObserver | null = null;
  private checkInterval: any = null;
  private scrollHandler: (() => void) | null = null;

  ngOnInit(): void {
    // Инициализация будет в AfterViewInit
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contentElement'] && this.contentElement) {
      // Даем время на рендеринг контента
      setTimeout(() => {
        this.extractHeadings();
        this.setupIntersectionObserver();
      }, 300);
    }
  }

  ngAfterViewInit(): void {
    if (this.contentElement) {
      // Используем интервал для проверки готовности контента
      this.checkInterval = setInterval(() => {
        if (this.contentElement && this.contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0) {
          this.extractHeadings();
          this.setupIntersectionObserver();
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
        }
      }, 100);
      
      // Останавливаем проверку через 5 секунд
      setTimeout(() => {
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }, 5000);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  extractHeadings(): void {
    if (!this.contentElement) return;

    const headings = this.contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    this.tocItems = [];

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent?.trim() || '';
      
      if (text) {
        // Создаем уникальный ID для заголовка
        let id = `heading-${index}`;
        const existingId = heading.id;
        if (existingId) {
          id = existingId;
        } else {
          heading.id = id;
        }

        this.tocItems.push({
          id,
          text,
          level,
          element: heading as HTMLElement
        });
      }
    });
  }

  scrollToHeading(item: TocItem): void {
    if (item.element) {
      const elementTop = item.element.getBoundingClientRect().top + window.pageYOffset;
      const offset = 80; // Отступ сверху для фиксированной навигации
      
      window.scrollTo({
        top: elementTop - offset,
        behavior: 'smooth'
      });

      // Подсвечиваем активный элемент
      this.activeItemId = item.id;
      setTimeout(() => {
        item.element.classList.add('toc-highlight');
        setTimeout(() => {
          item.element.classList.remove('toc-highlight');
        }, 2000);
      }, 100);
    }
  }

  scrollToComments(): void {
    const commentsElement = document.getElementById(this.commentsElementId);
    if (commentsElement) {
      const elementTop = commentsElement.getBoundingClientRect().top + window.pageYOffset;
      const offset = 80;
      
      window.scrollTo({
        top: elementTop - offset,
        behavior: 'smooth'
      });

      this.activeItemId = 'comments';
    }
  }

  setupIntersectionObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    const options = {
      root: null,
      rootMargin: '-100px 0px -70% 0px',
      threshold: [0, 0.1, 0.5, 1]
    };

    this.observer = new IntersectionObserver((entries) => {
      this.updateActiveItem();
    }, options);

    // Наблюдаем за всеми заголовками
    this.tocItems.forEach(item => {
      if (item.element) {
        this.observer?.observe(item.element);
      }
    });

    // Также наблюдаем за блоком комментариев
    const commentsElement = document.getElementById(this.commentsElementId);
    if (commentsElement) {
      this.observer.observe(commentsElement);
    }

    // Добавляем обработчик скролла для более точного определения
    this.scrollHandler = () => {
      this.updateActiveItem();
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  updateActiveItem(): void {
    const scrollPosition = window.scrollY + 100; // Отступ для фиксированной навигации
    let activeId: string | null = null;
    let minDistance = Infinity;

    // Проверяем заголовки
    this.tocItems.forEach(item => {
      if (item.element) {
        const elementTop = item.element.getBoundingClientRect().top + window.scrollY;
        const distance = Math.abs(elementTop - scrollPosition);
        
        if (elementTop <= scrollPosition + 50 && distance < minDistance) {
          minDistance = distance;
          activeId = item.id;
        }
      }
    });

    // Проверяем комментарии
    const commentsElement = document.getElementById(this.commentsElementId);
    if (commentsElement) {
      const commentsTop = commentsElement.getBoundingClientRect().top + window.scrollY;
      const distance = Math.abs(commentsTop - scrollPosition);
      
      if (commentsTop <= scrollPosition + 50 && distance < minDistance) {
        activeId = 'comments';
      }
    }

    if (activeId) {
      this.activeItemId = activeId;
    }
  }

  getItemClass(item: TocItem): string {
    const classes = ['toc-item'];
    classes.push(`toc-level-${item.level}`);
    if (this.activeItemId === item.id) {
      classes.push('active');
    }
    return classes.join(' ');
  }

  getCommentsClass(): string {
    return this.activeItemId === 'comments' ? 'toc-item toc-comments active' : 'toc-item toc-comments';
  }
}


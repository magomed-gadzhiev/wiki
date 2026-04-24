import { Component, Input, OnInit, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableOfContentsItem } from '../../core/models/article.model';

interface TocItem {
  id: string;
  text: string;
  level: number;
  element: HTMLElement | null;
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
  @Input() tableOfContents: TableOfContentsItem[] = [];
  
  tocItems: TocItem[] = [];
  activeItemId: string | null = null;
  private observer: IntersectionObserver | null = null;
  private checkInterval: any = null;
  private scrollHandler: (() => void) | null = null;

  ngOnInit(): void {
    // Инициализация будет в AfterViewInit
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tableOfContents']) {
      if (this.tableOfContents && this.tableOfContents.length > 0) {
        this.initializeTocFromBackend();
      } else {
        this.tocItems = [];
      }
      if (this.contentElement) {
        setTimeout(() => {
          this.linkTocItemsToElements();
          this.setupIntersectionObserver();
        }, 300);
      }
    }
    if (changes['contentElement'] && this.contentElement) {
      setTimeout(() => {
        this.linkTocItemsToElements();
        this.setupIntersectionObserver();
      }, 300);
    }
  }

  ngAfterViewInit(): void {
    if (this.tableOfContents && this.tableOfContents.length > 0 && this.tocItems.length === 0) {
      this.initializeTocFromBackend();
    }
    if (this.contentElement) {
      setTimeout(() => {
        this.linkTocItemsToElements();
        this.setupIntersectionObserver();
      }, 300);
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

  initializeTocFromBackend(): void {
    // Инициализируем навигацию из данных с backend
    if (!this.tableOfContents || this.tableOfContents.length === 0) {
      this.tocItems = [];
      return;
    }

    this.tocItems = this.tableOfContents.map(item => ({
      id: item.id,
      text: item.text,
      level: item.level,
      element: null as HTMLElement | null
    }));

    // Связываем элементы с DOM после рендеринга
    if (this.contentElement) {
      this.linkTocItemsToElements();
    }
  }

  linkTocItemsToElements(): void {
    // Связываем элементы навигации с реальными заголовками в DOM
    if (!this.contentElement) return;

    this.tocItems.forEach(item => {
      if (!item.element) {
        const element = this.contentElement.querySelector(`#${item.id}`);
        if (element) {
          item.element = element as HTMLElement;
        }
      }
    });
  }

  scrollToHeading(item: TocItem): void {
    // Если элемент еще не связан, пытаемся найти его
    if (!item.element && this.contentElement) {
      const element = this.contentElement.querySelector(`#${item.id}`);
      if (element) {
        item.element = element as HTMLElement;
      }
    }

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
        if (item.element) {
          item.element.classList.add('toc-highlight');
          setTimeout(() => {
            if (item.element) {
              item.element.classList.remove('toc-highlight');
            }
          }, 2000);
        }
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

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
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
      // Если элемент еще не связан, пытаемся найти его
      if (!item.element && this.contentElement) {
        const element = this.contentElement.querySelector(`#${item.id}`);
        if (element) {
          item.element = element as HTMLElement;
        }
      }

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


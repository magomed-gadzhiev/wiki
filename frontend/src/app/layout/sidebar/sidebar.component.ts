import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { AuthService } from '../../core/services/auth.service';
import { Technology, Element } from '../../core/models/article.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  technologies: Technology[] = [];
  elementsWithoutTechnology: Element[] = [];
  expandedTechnologies: Set<string> = new Set();
  currentElementId: string | null = null;

  constructor(
    private articleService: ArticleService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  currentUser() {
    return this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }

  ngOnInit(): void {
    // Загружаем элементы только если пользователь авторизован
    if (this.isAuthenticated()) {
      this.loadTechnologies();
      this.loadElementsWithoutTechnology();
    }
    this.checkCurrentElement();
  }

  loadTechnologies(): void {
    // Загружаем технологии только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getTechnologies().subscribe({
      next: (technologies) => {
        this.technologies = technologies;
        // По умолчанию все dropdown свернуты
      },
      error: () => {
        // Ошибка загрузки технологий
      }
    });
  }

  loadElementsWithoutTechnology(): void {
    // Загружаем элементы только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getElements().subscribe({
      next: (elements) => {
        // Фильтруем элементы без технологии
        this.elementsWithoutTechnology = elements.filter(el => !el.technology);
        // Сортируем по sort_order и name
        this.elementsWithoutTechnology.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          return a.name.localeCompare(b.name);
        });
      },
      error: () => {
        // Ошибка загрузки элементов без технологии
      }
    });
  }

  checkCurrentElement(): void {
    // Проверяем текущий элемент при инициализации
    this.updateCurrentElement();
    
    // Подписываемся на изменения маршрута
    this.router.events.subscribe(() => {
      this.updateCurrentElement();
    });
  }

  updateCurrentElement(): void {
    const url = this.router.url;
    const match = url.match(/\/elements\/([^\/]+)/);
    if (match) {
      this.currentElementId = match[1];
      // По умолчанию dropdown свернуты, не раскрываем автоматически
    } else {
      this.currentElementId = null;
    }
  }

  toggleTechnology(technologyId: string): void {
    if (this.expandedTechnologies.has(technologyId)) {
      this.expandedTechnologies.delete(technologyId);
    } else {
      this.expandedTechnologies.add(technologyId);
    }
  }

  isTechnologyExpanded(technologyId: string): boolean {
    return this.expandedTechnologies.has(technologyId);
  }

  isElementActive(elementId: string): boolean {
    return this.currentElementId === elementId;
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  closeDropdown(technologyId: string): void {
    // Закрываем dropdown после выбора элемента
    this.expandedTechnologies.delete(technologyId);
  }
}


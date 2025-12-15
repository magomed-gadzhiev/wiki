import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { AuthService } from '../../core/services/auth.service';
import { Technology, Category } from '../../core/models/article.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  technologies: Technology[] = [];
  categoriesWithoutTechnology: Category[] = [];
  expandedTechnologies: Set<string> = new Set();
  currentCategoryId: string | null = null;

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
    // Загружаем категории только если пользователь авторизован
    if (this.isAuthenticated()) {
      this.loadTechnologies();
      this.loadCategoriesWithoutTechnology();
    }
    this.checkCurrentCategory();
  }

  loadTechnologies(): void {
    // Загружаем технологии только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getTechnologies().subscribe({
      next: (technologies) => {
        this.technologies = technologies || [];
        // Убеждаемся, что у каждой технологии есть массив categories
        this.technologies.forEach(tech => {
          if (!tech.categories) {
            tech.categories = [];
          }
        });
        // По умолчанию все dropdown свернуты
      },
      error: (err) => {
        console.error('Ошибка загрузки технологий:', err);
        this.technologies = [];
      }
    });
  }

  loadCategoriesWithoutTechnology(): void {
    // Загружаем категории только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getCategories().subscribe({
      next: (categories) => {
        // Фильтруем категории без технологии
        this.categoriesWithoutTechnology = categories.filter(cat => !cat.technology);
        // Сортируем по sort_order и name
        this.categoriesWithoutTechnology.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          return a.name.localeCompare(b.name);
        });
      },
      error: () => {
        // Ошибка загрузки категорий без технологии
      }
    });
  }

  checkCurrentCategory(): void {
    // Проверяем текущую категорию при инициализации
    this.updateCurrentCategory();
    
    // Подписываемся на изменения маршрута
    this.router.events.subscribe(() => {
      this.updateCurrentCategory();
    });
  }

  updateCurrentCategory(): void {
    const url = this.router.url;
    const match = url.match(/\/categories\/([^\/]+)/);
    if (match) {
      this.currentCategoryId = match[1];
      // По умолчанию dropdown свернуты, не раскрываем автоматически
    } else {
      this.currentCategoryId = null;
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

  isCategoryActive(categoryId: string): boolean {
    return this.currentCategoryId === categoryId;
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  closeDropdown(technologyId: string): void {
    // Закрываем dropdown после выбора категории
    this.expandedTechnologies.delete(technologyId);
  }
}


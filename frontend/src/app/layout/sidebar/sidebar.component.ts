import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { AuthService } from '../../core/services/auth.service';
import { Section, Category } from '../../core/models/article.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <div class="sidebar-header">
          <h1 class="logo">
            <a routerLink="/">Mikron Wiki</a>
          </h1>
        </div>
        <div class="user-section">
          <div class="user-menu" *ngIf="isAuthenticated(); else loginBlock">
            <span class="username">{{ currentUser()?.username }}</span>
            <button class="btn btn-secondary" (click)="logout()">Выход</button>
          </div>
          <ng-template #loginBlock>
            <a routerLink="/login" class="btn btn-primary">Вход</a>
          </ng-template>
        </div>
        <ul class="nav-links">
          <li class="nav-link-item">
            <a routerLink="/articles" routerLinkActive="active-link" class="nav-link">
              Все статьи
            </a>
          </li>
        </ul>
        <ul class="sections-list">
          <li *ngFor="let section of sections" class="section-item">
            <div 
              class="section-header" 
              (click)="toggleSection(section.id)"
              [class.active]="isSectionExpanded(section.id)"
            >
              <span class="section-name">{{ section.name }}</span>
              <span class="section-toggle" [class.expanded]="isSectionExpanded(section.id)">
                ▼
              </span>
            </div>
            <ul 
              class="categories-list" 
              *ngIf="isSectionExpanded(section.id)"
            >
              <li 
                *ngFor="let category of section.categories" 
                class="category-item"
                [class.active]="isCategoryActive(category.id)"
              >
                <a 
                  [routerLink]="['/categories', category.id]" 
                  routerLinkActive="active-link"
                  class="category-link"
                >
                  {{ category.name }}
                </a>
              </li>
            </ul>
          </li>
        </ul>
        <ul class="categories-list" *ngIf="categoriesWithoutSection.length > 0">
          <li 
            *ngFor="let category of categoriesWithoutSection" 
            class="category-item"
            [class.active]="isCategoryActive(category.id)"
          >
            <a 
              [routerLink]="['/categories', category.id]" 
              routerLinkActive="active-link"
              class="category-link"
            >
              {{ category.name }}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 250px;
      min-height: 100vh;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
      padding: 0;
      position: sticky;
      top: 0;
      overflow-y: auto;
      max-height: 100vh;
    }

    .sidebar-nav {
      padding: 0;
    }

    .sidebar-header {
      padding: 20px;
      background: white;
      border-bottom: 1px solid #dee2e6;
    }

    .logo {
      font-size: 24px;
      margin: 0;
    }

    .logo a {
      text-decoration: none;
      color: #007bff;
    }

    .user-section {
      padding: 15px 20px;
      background: white;
      border-bottom: 1px solid #dee2e6;
    }

    .user-menu {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .username {
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      transition: background-color 0.2s;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background-color: #0056b3;
    }

    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background-color: #545b62;
    }

    .sidebar-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 20px 20px;
      color: #333;
      padding-bottom: 10px;
      border-bottom: 2px solid #dee2e6;
    }

    .nav-links {
      list-style: none;
      padding: 0;
      margin: 0 0 15px 0;
    }

    .nav-link-item {
      margin: 0;
    }

    .nav-link {
      display: block;
      padding: 12px 20px;
      color: #555;
      text-decoration: none;
      transition: background-color 0.2s, color 0.2s;
      border-left: 3px solid transparent;
      font-size: 15px;
      font-weight: 500;
    }

    .nav-link:hover {
      background-color: #e9ecef;
      color: #007bff;
    }

    .nav-link.active-link {
      background-color: #e7f3ff;
      color: #007bff;
      border-left-color: #007bff;
    }

    .sections-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .section-item {
      margin: 0;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s;
      border-left: 3px solid transparent;
    }

    .section-header:hover {
      background-color: #e9ecef;
    }

    .section-header.active {
      background-color: #e7f3ff;
      border-left-color: #007bff;
    }

    .section-name {
      font-weight: 500;
      color: #333;
      font-size: 15px;
    }

    .section-toggle {
      font-size: 10px;
      color: #666;
      transition: transform 0.2s;
      transform: rotate(-90deg);
    }

    .section-toggle.expanded {
      transform: rotate(0deg);
    }

    .categories-list {
      list-style: none;
      padding: 0;
      margin: 0;
      background-color: #ffffff;
      border-top: 1px solid #e9ecef;
    }

    .category-item {
      margin: 0;
    }

    .category-link {
      display: block;
      padding: 10px 20px 10px 40px;
      color: #555;
      text-decoration: none;
      transition: background-color 0.2s, color 0.2s;
      border-left: 3px solid transparent;
      font-size: 14px;
    }

    .category-link:hover {
      background-color: #f0f0f0;
      color: #007bff;
    }

    .category-link.active-link,
    .category-item.active .category-link {
      background-color: #e7f3ff;
      color: #007bff;
      border-left-color: #007bff;
      font-weight: 500;
    }
  `]
})
export class SidebarComponent implements OnInit {
  sections: Section[] = [];
  categoriesWithoutSection: Category[] = [];
  expandedSections: Set<string> = new Set();
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
      this.loadSections();
      this.loadCategoriesWithoutSection();
    }
    this.checkCurrentCategory();
  }

  loadSections(): void {
    // Загружаем секции только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getSections().subscribe({
      next: (sections) => {
        this.sections = sections;
        // Автоматически раскрываем раздел, если текущая категория в нем
        if (this.currentCategoryId) {
          const currentSection = sections.find(s => 
            s.categories.some(c => c.id === this.currentCategoryId)
          );
          if (currentSection) {
            this.expandedSections.add(currentSection.id);
          }
        }
      },
      error: (err) => {
        console.error('Ошибка загрузки разделов:', err);
      }
    });
  }

  loadCategoriesWithoutSection(): void {
    // Загружаем категории только если пользователь авторизован
    if (!this.isAuthenticated()) {
      return;
    }
    
    this.articleService.getCategories().subscribe({
      next: (categories) => {
        // Фильтруем категории без раздела
        this.categoriesWithoutSection = categories.filter(cat => !cat.section);
        // Сортируем по sort_order и name
        this.categoriesWithoutSection.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          return a.name.localeCompare(b.name);
        });
      },
      error: (err) => {
        console.error('Ошибка загрузки категорий без раздела:', err);
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
      // Раскрываем соответствующий раздел, если категория в разделе
      const currentSection = this.sections.find(s => 
        s.categories.some(c => c.id === this.currentCategoryId)
      );
      if (currentSection) {
        this.expandedSections.add(currentSection.id);
      }
      // Если категория без раздела, она уже отображается отдельно
    } else {
      this.currentCategoryId = null;
    }
  }

  toggleSection(sectionId: string): void {
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSections.has(sectionId);
  }

  isCategoryActive(categoryId: string): boolean {
    return this.currentCategoryId === categoryId;
  }
}


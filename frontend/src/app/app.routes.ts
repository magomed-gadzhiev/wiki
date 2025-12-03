import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/articles',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'change-password',
    loadComponent: () => import('./auth/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    canActivate: [authGuard]
  },
  {
    path: 'articles',
    loadComponent: () => import('./articles/article-list/article-list.component').then(m => m.ArticleListComponent)
  },
  {
    path: 'technologies/:id',
    loadComponent: () => import('./articles/technology-articles/technology-articles.component').then(m => m.TechnologyArticlesComponent)
  },
  {
    path: 'elements/:id',
    loadComponent: () => import('./articles/category-articles/category-articles.component').then(m => m.CategoryArticlesComponent)
  },
  {
    path: 'elements/:id/articles/new',
    loadComponent: () => import('./articles/article-editor/article-editor.component').then(m => m.ArticleEditorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'articles/new',
    loadComponent: () => import('./articles/article-create-wizard/article-create-wizard.component').then(m => m.ArticleCreateWizardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'articles/:id/versions',
    loadComponent: () => import('./articles/article-versions/article-versions.component').then(m => m.ArticleVersionsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'articles/:id/edit',
    loadComponent: () => import('./articles/article-editor/article-editor.component').then(m => m.ArticleEditorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'articles/:id',
    loadComponent: () => import('./articles/article-detail/article-detail.component').then(m => m.ArticleDetailComponent)
  }
];


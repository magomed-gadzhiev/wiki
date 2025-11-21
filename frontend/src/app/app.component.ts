import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { AuthService } from './core/services/auth.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  template: `
    <div class="app-container">
      <div class="content-wrapper">
        <app-sidebar></app-sidebar>
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .content-wrapper {
      display: flex;
      flex: 1;
    }
    .main-content {
      flex: 1;
      padding: 20px;
      overflow-x: auto;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'Mikron Wiki';
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    // Проверка авторизации при загрузке приложения
    const currentUrl = this.router.url;
    
    // Не проверяем авторизацию на страницах логина и регистрации
    if (currentUrl.startsWith('/login') || currentUrl.startsWith('/register')) {
      return;
    }
    
    // Если есть токен, проверяем его валидность
    if (this.authService.getAccessToken()) {
      this.authService.checkAuth().pipe(
        catchError(() => {
          // Если токен невалиден, очищаем и редиректим на логин
          this.authService.logout();
          this.router.navigate(['/login']);
          return of(null);
        })
      ).subscribe();
    } else {
      // Если нет токена, редиректим на логин
      this.router.navigate(['/login']);
    }
  }
}


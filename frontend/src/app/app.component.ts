import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { BreadcrumbsComponent } from './layout/breadcrumbs/breadcrumbs.component';
import { AuthService } from './core/services/auth.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, BreadcrumbsComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
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
      ).subscribe(user => {
        // Если требуется смена пароля и пользователь не на странице смены пароля, перенаправляем
        if (user && user.must_change_password && !currentUrl.startsWith('/change-password')) {
          this.router.navigate(['/change-password']);
        }
      });
    } else {
      // Если нет токена, редиректим на логин
      this.router.navigate(['/login']);
    }
  }
}


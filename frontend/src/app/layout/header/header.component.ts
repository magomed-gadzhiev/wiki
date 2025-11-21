import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header">
      <div class="container">
        <div class="header-content">
          <h1 class="logo">
            <a routerLink="/">Mikron Wiki</a>
          </h1>
          <div class="user-menu" *ngIf="isAuthenticated(); else loginBlock">
            <span class="username">{{ currentUser()?.username }}</span>
            <button class="btn btn-secondary" (click)="logout()">Выход</button>
          </div>
          <ng-template #loginBlock>
            <a routerLink="/login" class="btn btn-primary">Вход</a>
          </ng-template>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
    }
    .logo {
      font-size: 24px;
      margin: 0;
    }
    .logo a {
      text-decoration: none;
      color: #007bff;
    }
    .user-menu {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .username {
      font-weight: 500;
    }
  `]
})
export class HeaderComponent {
  constructor(public authService: AuthService) {}

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  currentUser() {
    return this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }
}


import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="card login-card">
        <h2>Вход</h2>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="username">Имя пользователя</label>
            <input 
              id="username" 
              type="text" 
              formControlName="username" 
              [class.error]="loginForm.get('username')?.invalid && loginForm.get('username')?.touched"
            />
            <div *ngIf="loginForm.get('username')?.invalid && loginForm.get('username')?.touched" class="error-message">
              Имя пользователя обязательно
            </div>
          </div>
          
          <div class="form-group">
            <label for="password">Пароль</label>
            <input 
              id="password" 
              type="password" 
              formControlName="password"
              [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
            />
            <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="error-message">
              Пароль обязателен
            </div>
          </div>
          
          <div *ngIf="error" class="error-message">{{ error }}</div>
          
          <button type="submit" class="btn btn-primary" [disabled]="loginForm.invalid || loading">
            {{ loading ? 'Вход...' : 'Войти' }}
          </button>
        </form>
        
        <p class="register-link">
          Нет аккаунта? <a routerLink="/register">Зарегистрироваться</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
    }
    .login-card {
      max-width: 400px;
      width: 100%;
    }
    .login-card h2 {
      margin-bottom: 20px;
    }
    .error-message {
      color: #dc3545;
      font-size: 12px;
      margin-top: 5px;
    }
    input.error {
      border-color: #dc3545;
    }
    .register-link {
      margin-top: 15px;
      text-align: center;
    }
    .register-link a {
      color: #007bff;
      text-decoration: none;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.error = null;
      
      this.authService.login(
        this.loginForm.value.username,
        this.loginForm.value.password
      ).subscribe({
        next: () => {
          this.router.navigate(['/articles']);
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка входа';
          this.loading = false;
        }
      });
    }
  }
}


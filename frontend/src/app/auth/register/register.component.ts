import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="register-container">
      <div class="card register-card">
        <h2>Регистрация</h2>
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="username">Имя пользователя</label>
            <input 
              id="username" 
              type="text" 
              formControlName="username"
              [class.error]="registerForm.get('username')?.invalid && registerForm.get('username')?.touched"
            />
            <div *ngIf="registerForm.get('username')?.invalid && registerForm.get('username')?.touched" class="error-message">
              Имя пользователя обязательно
            </div>
          </div>
          
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              id="email" 
              type="email" 
              formControlName="email"
            />
          </div>
          
          <div class="form-group">
            <label for="first_name">Имя</label>
            <input 
              id="first_name" 
              type="text" 
              formControlName="first_name"
            />
          </div>
          
          <div class="form-group">
            <label for="last_name">Фамилия</label>
            <input 
              id="last_name" 
              type="text" 
              formControlName="last_name"
            />
          </div>
          
          <div class="form-group">
            <label for="password">Пароль</label>
            <input 
              id="password" 
              type="password" 
              formControlName="password"
              [class.error]="registerForm.get('password')?.invalid && registerForm.get('password')?.touched"
            />
            <div *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched" class="error-message">
              Пароль обязателен (минимум 8 символов)
            </div>
          </div>
          
          <div class="form-group">
            <label for="password_confirm">Подтверждение пароля</label>
            <input 
              id="password_confirm" 
              type="password" 
              formControlName="password_confirm"
              [class.error]="registerForm.get('password_confirm')?.invalid && registerForm.get('password_confirm')?.touched"
            />
            <div *ngIf="registerForm.get('password_confirm')?.invalid && registerForm.get('password_confirm')?.touched" class="error-message">
              Пароли не совпадают
            </div>
          </div>
          
          <div *ngIf="error" class="error-message">{{ error }}</div>
          
          <button type="submit" class="btn btn-primary" [disabled]="registerForm.invalid || loading">
            {{ loading ? 'Регистрация...' : 'Зарегистрироваться' }}
          </button>
        </form>
        
        <p class="login-link">
          Уже есть аккаунт? <a routerLink="/login">Войти</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
    }
    .register-card {
      max-width: 400px;
      width: 100%;
    }
    .register-card h2 {
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
    .login-link {
      margin-top: 15px;
      text-align: center;
    }
    .login-link a {
      color: #007bff;
      text-decoration: none;
    }
  `]
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: [''],
      first_name: [''],
      last_name: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['']
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const passwordConfirm = form.get('password_confirm');
    
    if (password && passwordConfirm && password.value !== passwordConfirm.value) {
      passwordConfirm.setErrors({ passwordMismatch: true });
    } else if (passwordConfirm && passwordConfirm.hasError('passwordMismatch')) {
      passwordConfirm.setErrors(null);
    }
    
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.loading = true;
      this.error = null;
      
      const formValue = this.registerForm.value;
      this.authService.register(
        formValue.username,
        formValue.password,
        formValue.email,
        formValue.first_name,
        formValue.last_name
      ).subscribe({
        next: () => {
          this.router.navigate(['/articles']);
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка регистрации';
          this.loading = false;
        }
      });
    }
  }
}


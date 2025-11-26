import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="change-password-container">
      <div class="card change-password-card">
        <h2>Смена пароля</h2>
        <p class="info-message">Для безопасности необходимо сменить пароль при первом входе.</p>
        <form [formGroup]="changePasswordForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="oldPassword">Текущий пароль</label>
            <input 
              id="oldPassword" 
              type="password" 
              formControlName="oldPassword" 
              [class.error]="changePasswordForm.get('oldPassword')?.invalid && changePasswordForm.get('oldPassword')?.touched"
            />
            <div *ngIf="changePasswordForm.get('oldPassword')?.invalid && changePasswordForm.get('oldPassword')?.touched" class="error-message">
              Текущий пароль обязателен
            </div>
          </div>
          
          <div class="form-group">
            <label for="newPassword">Новый пароль</label>
            <input 
              id="newPassword" 
              type="password" 
              formControlName="newPassword"
              [class.error]="changePasswordForm.get('newPassword')?.invalid && changePasswordForm.get('newPassword')?.touched"
            />
            <div *ngIf="changePasswordForm.get('newPassword')?.invalid && changePasswordForm.get('newPassword')?.touched" class="error-message">
              Новый пароль обязателен
            </div>
          </div>
          
          <div class="form-group">
            <label for="confirmPassword">Подтвердите новый пароль</label>
            <input 
              id="confirmPassword" 
              type="password" 
              formControlName="confirmPassword"
              [class.error]="changePasswordForm.get('confirmPassword')?.invalid && changePasswordForm.get('confirmPassword')?.touched"
            />
            <div *ngIf="changePasswordForm.get('confirmPassword')?.invalid && changePasswordForm.get('confirmPassword')?.touched" class="error-message">
              Подтверждение пароля обязательно
            </div>
            <div *ngIf="changePasswordForm.hasError('passwordMismatch') && changePasswordForm.get('confirmPassword')?.touched" class="error-message">
              Пароли не совпадают
            </div>
          </div>
          
          <div *ngIf="error" class="error-message">{{ error }}</div>
          <div *ngIf="success" class="success-message">{{ success }}</div>
          
          <button type="submit" class="btn btn-primary" [disabled]="changePasswordForm.invalid || loading">
            {{ loading ? 'Смена пароля...' : 'Сменить пароль' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .change-password-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
    }
    .change-password-card {
      max-width: 400px;
      width: 100%;
    }
    .change-password-card h2 {
      margin-bottom: 20px;
    }
    .info-message {
      margin-bottom: 20px;
      padding: 10px;
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      color: #856404;
    }
    .error-message {
      color: #dc3545;
      font-size: 12px;
      margin-top: 5px;
    }
    .success-message {
      color: #28a745;
      font-size: 14px;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    input.error {
      border-color: #dc3545;
    }
  `]
})
export class ChangePasswordComponent {
  changePasswordForm: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.changePasswordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.changePasswordForm.valid) {
      this.loading = true;
      this.error = null;
      this.success = null;
      
      const { oldPassword, newPassword } = this.changePasswordForm.value;
      
      this.authService.changePassword(oldPassword, newPassword).subscribe({
        next: (response) => {
          this.success = response.message;
          this.loading = false;
          // Перенаправляем на главную страницу через 2 секунды
          setTimeout(() => {
            this.router.navigate(['/articles']);
          }, 2000);
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка при смене пароля';
          this.loading = false;
        }
      });
    }
  }
}


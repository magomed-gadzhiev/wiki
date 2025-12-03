import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
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


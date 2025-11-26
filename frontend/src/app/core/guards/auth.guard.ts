import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Если пользователь не на странице смены пароля и требуется смена пароля, перенаправляем
  const user = authService.getCurrentUser();
  if (user?.must_change_password && state.url !== '/change-password') {
    router.navigate(['/change-password']);
    return false;
  }

  return true;
};


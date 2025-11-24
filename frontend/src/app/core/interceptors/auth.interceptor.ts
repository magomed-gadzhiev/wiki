import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const token = authService.getAccessToken();
  const isRefreshRequest = req.url.includes('/api/auth/refresh/');
  
  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Если это запрос на refresh и получили 401 - сразу разлогиниваем
        // (не пытаемся обновить токен, чтобы избежать бесконечного цикла)
        if (isRefreshRequest) {
          handleUnauthorized(authService, router);
          return throwError(() => error);
        }
        
        // Если есть токен, пытаемся обновить его
        if (token) {
          const refreshToken = authService.getRefreshToken();
          if (refreshToken) {
            return authService.refreshAccessToken().pipe(
              switchMap((response) => {
                // Успешно обновили токен, повторяем запрос
                clonedReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${response.access}`
                  }
                });
                return next(clonedReq);
              }),
              catchError((err) => {
                // Не удалось обновить токен - разлогиниваем и редиректим
                handleUnauthorized(authService, router);
                return throwError(() => err);
              })
            );
          }
        }
        
        // Нет токена или нет refresh token - разлогиниваем и редиректим
        handleUnauthorized(authService, router);
      }
      
      return throwError(() => error);
    })
  );
};

function handleUnauthorized(authService: AuthService, router: Router): void {
  // Разлогиниваем пользователя
  authService.logout();
  
  // Перенаправляем на страницу авторизации, если еще не там
  const currentUrl = router.url;
  if (!currentUrl.startsWith('/login') && !currentUrl.startsWith('/register')) {
    router.navigate(['/login']).catch(() => {
      // Если navigate не сработал, пробуем navigateByUrl
      window.location.href = '/login';
    });
  }
}


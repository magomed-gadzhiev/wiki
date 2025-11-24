import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User } from '../models/user.model';

export interface LoginResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  register(username: string, password: string, email?: string, firstName?: string, lastName?: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register/`, {
      username,
      password,
      email,
      first_name: firstName,
      last_name: lastName
    }).pipe(
      tap(response => this.setUser(response.user, response.tokens))
    );
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login/`, {
      username,
      password
    }).pipe(
      tap(response => this.setUser(response.user, response.tokens))
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  refreshAccessToken(): Observable<{ access: string }> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }
    return this.http.post<{ access: string }>(`${this.apiUrl}/refresh/`, {
      refresh: refreshToken
    }).pipe(
      tap(response => {
        localStorage.setItem('access_token', response.access);
      })
    );
  }

  checkAuth(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me/`).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem('user', JSON.stringify(user));
      })
    );
  }

  private setUser(user: User, tokens: { access: string; refresh: string }): void {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        // Ошибка загрузки пользователя из хранилища
      }
    }
  }
}


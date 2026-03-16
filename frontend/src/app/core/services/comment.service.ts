import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Comment, CommentCreate } from '../models/comment.model';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = `${environment.apiBaseUrl}/articles/comments`;

  constructor(private http: HttpClient) {}

  getComments(articleId: string): Observable<Comment[]> {
    const params = new HttpParams().set('article', articleId);
    return this.http.get<{ results: Comment[]; count: number } | Comment[]>(`${this.apiUrl}/`, { params }).pipe(
      map(response => Array.isArray(response) ? response : response.results)
    );
  }

  getComment(id: string): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${id}/`);
  }

  createComment(comment: CommentCreate): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/`, comment);
  }

  updateComment(id: string, comment: Partial<CommentCreate>): Observable<Comment> {
    return this.http.put<Comment>(`${this.apiUrl}/${id}/`, comment);
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }
}


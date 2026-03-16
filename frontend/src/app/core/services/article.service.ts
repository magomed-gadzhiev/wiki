import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Article, ArticleVersion, ArticleImage, ArticleAttachment, Category, Model, Technology, Tag, ArticleOption, ArticleOptionValue, ArticleTemplate } from '../models/article.model';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root'
})
export class ArticleService {
  private apiUrl = `${environment.apiBaseUrl}/articles`;

  constructor(private http: HttpClient) {}

  getArticles(params?: { 
    search?: string; 
    author?: number; 
    is_published?: boolean;
    model?: string;
    tags?: string[];
    optionFilters?: { option_id: string; option_value: string }[];
  }): Observable<{ results: Article[]; count: number }> {
    let httpParams = new HttpParams();
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.author) {
      httpParams = httpParams.set('author', params.author.toString());
    }
    if (params?.is_published !== undefined) {
      httpParams = httpParams.set('is_published', params.is_published.toString());
    }
    if (params?.model) {
      httpParams = httpParams.set('model', params.model);
    }
    // Фильтр по тегам
    if (params?.tags && params.tags.length > 0) {
      params.tags.forEach(tagId => {
        httpParams = httpParams.append('tags', tagId);
      });
    }
    // Фильтр по опциям
    if (params?.optionFilters && params.optionFilters.length > 0) {
      params.optionFilters.forEach(filter => {
        if (filter.option_id && filter.option_value) {
          httpParams = httpParams.append('option_id', filter.option_id);
          httpParams = httpParams.append('option_value', filter.option_value);
        }
      });
    }
    return this.http.get<{ results: Article[]; count: number }>(`${this.apiUrl}/`, { params: httpParams });
  }

  getArticle(id: string): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/${id}/`);
  }

  createArticle(article: Partial<Article>): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/`, article);
  }

  updateArticle(id: string, article: Partial<Article>): Observable<Article> {
    return this.http.put<Article>(`${this.apiUrl}/${id}/`, article);
  }

  deleteArticle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }

  getVersions(articleId: string): Observable<ArticleVersion[]> {
    return this.http.get<ArticleVersion[]>(`${this.apiUrl}/${articleId}/versions/`);
  }

  restoreVersion(articleId: string, versionId: string): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/${articleId}/restore_version/`, { version_id: versionId });
  }

  uploadImage(articleId: string, image: File, altText?: string): Observable<ArticleImage> {
    const formData = new FormData();
    formData.append('image', image);
    if (altText) {
      formData.append('alt_text', altText);
    }
    return this.http.post<ArticleImage>(`${this.apiUrl}/${articleId}/upload_image/`, formData);
  }

  uploadAttachment(articleId: string, file: File, comment?: string): Observable<ArticleAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (comment) {
      formData.append('comment', comment);
    }
    return this.http.post<ArticleAttachment>(`${this.apiUrl}/${articleId}/upload_attachment/`, formData);
  }

  importWord(file: File): Observable<{ content: string; warnings: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ content: string; warnings: string[] }>(`${this.apiUrl}/import_word/`, formData);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories/`).pipe(
      map(response => {
        const categories = Array.isArray(response) ? response : [];
        // Убеждаемся, что у каждой категории есть массив models
        return categories.map(cat => ({
          ...cat,
          models: Array.isArray(cat.models) ? cat.models : []
        }));
      })
    );
  }

  getCategory(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/categories/${id}/`).pipe(
      map(cat => ({
        ...cat,
        models: Array.isArray(cat.models) ? cat.models : []
      }))
    );
  }

  getModels(params?: { category?: string }): Observable<Model[]> {
    let httpParams = new HttpParams();
    if (params?.category) {
      httpParams = httpParams.set('category', params.category);
    }
    return this.http.get<Model[]>(`${this.apiUrl}/models/`, { params: httpParams }).pipe(
      map(response => Array.isArray(response) ? response : [])
    );
  }

  getModel(id: string): Observable<Model> {
    return this.http.get<Model>(`${this.apiUrl}/models/${id}/`);
  }

  getTechnologies(): Observable<Technology[]> {
    return this.http.get<Technology[]>(`${this.apiUrl}/technologies/`).pipe(
      map(response => {
        const technologies = Array.isArray(response) ? response : [];
        // Убеждаемся, что у каждой технологии есть массив categories
        return technologies.map(tech => ({
          ...tech,
          categories: Array.isArray(tech.categories) ? tech.categories : []
        }));
      })
    );
  }

  getTechnology(id: string): Observable<Technology> {
    return this.http.get<Technology>(`${this.apiUrl}/technologies/${id}/`).pipe(
      map(tech => ({
        ...tech,
        categories: Array.isArray(tech.categories) ? tech.categories : []
      }))
    );
  }

  getTags(search?: string): Observable<Tag[]> {
    let httpParams = new HttpParams();
    if (search) {
      httpParams = httpParams.set('search', search);
    }
    return this.http.get<{ results: Tag[]; count: number } | Tag[]>(`${this.apiUrl}/tags/`, { params: httpParams }).pipe(
      map(response => Array.isArray(response) ? response : response.results)
    );
  }

  createTag(tag: { name: string }): Observable<Tag> {
    return this.http.post<Tag>(`${this.apiUrl}/tags/`, tag);
  }

  getOptions(): Observable<ArticleOption[]> {
    return this.http.get<{ results: ArticleOption[]; count: number } | ArticleOption[]>(`${this.apiUrl}/options/`).pipe(
      map(response => Array.isArray(response) ? response : response.results)
    );
  }

  getTemplates(): Observable<ArticleTemplate[]> {
    return this.http.get<{ results: ArticleTemplate[]; count: number } | ArticleTemplate[]>(`${this.apiUrl}/templates/`).pipe(
      map(response => Array.isArray(response) ? response : response.results)
    );
  }

  publishArticle(id: string): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/${id}/publish/`, {});
  }

  unpublishArticle(id: string): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/${id}/unpublish/`, {});
  }
}


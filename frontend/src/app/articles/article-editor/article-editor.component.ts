import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ArticleService } from '../../core/services/article.service';
import { Article, Category, Tag, ArticleOption, ArticleOptionValue, ArticleAttachment } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import * as grapesjs from 'grapesjs';

@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h1>{{ isEditMode ? 'Редактирование статьи' : 'Новая статья' }}</h1>
      
      <form [formGroup]="articleForm" (ngSubmit)="onSubmit()">
        <div class="card">
          <div class="form-group">
            <label for="title">Заголовок *</label>
            <input 
              id="title" 
              type="text" 
              formControlName="title"
              [class.error]="articleForm.get('title')?.invalid && articleForm.get('title')?.touched"
            />
            <div *ngIf="articleForm.get('title')?.invalid && articleForm.get('title')?.touched" class="error-message">
              Заголовок обязателен
            </div>
          </div>
          
          <div class="form-group">
            <label for="summary">Краткое описание</label>
            <textarea 
              id="summary" 
              formControlName="summary"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="category_id">Категория</label>
            <select 
              id="category_id" 
              formControlName="category_id"
            >
              <option [ngValue]="null">-- Без категории --</option>
              <option *ngFor="let category of (categories || []); trackBy: trackByCategoryId" [ngValue]="category.id">
                {{ category.name }}
              </option>
            </select>
            <div *ngIf="articleForm.get('category_id')?.value" style="font-size: 12px; color: #666; margin-top: 5px;">
              Текущее значение: {{ articleForm.get('category_id')?.value }}
            </div>
          </div>
          
          <div class="form-group">
            <label>Опции статьи</label>
            <div class="options-table-container">
              <table class="table table-bordered options-table">
                <thead>
                  <tr>
                    <th style="width: 40%;">Опция</th>
                    <th style="width: 50%;">Значение</th>
                    <th style="width: 10%;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let optionValue of optionValuesList; let i = index">
                    <td>
                      <select 
                        [(ngModel)]="optionValue.option_id"
                        [ngModelOptions]="{standalone: true}"
                        class="form-control form-control-sm"
                        [disabled]="!!optionValue.id"
                      >
                        <option [ngValue]="null">-- Выберите опцию --</option>
                        <option *ngFor="let option of getAvailableOptions(optionValue.option_id, i)" [ngValue]="option.id">
                          {{ option.name }}
                          <span *ngIf="option.description"> - {{ option.description }}</span>
                        </option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        [(ngModel)]="optionValue.value"
                        [ngModelOptions]="{standalone: true}"
                        class="form-control form-control-sm"
                        placeholder="Введите значение"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        (click)="removeOptionValue(i)"
                        title="Удалить"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="optionValuesList.length === 0">
                    <td colspan="3" class="text-center text-muted">
                      Нет добавленных опций
                    </td>
                  </tr>
                </tbody>
              </table>
              <button
                type="button"
                class="btn btn-sm btn-primary add-option-btn"
                (click)="addOptionValue()"
              >
                + Добавить опцию
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="tags">Теги</label>
            <div class="tags-container">
              <div class="tags-input-wrapper">
                <input 
                  type="text" 
                  id="tag-input"
                  [(ngModel)]="newTagName"
                  (keydown.enter)="addNewTag($event)"
                  (keydown.arrowdown)="navigateSuggestions($event, 1)"
                  (keydown.arrowup)="navigateSuggestions($event, -1)"
                  (keydown.escape)="hideSuggestions()"
                  (input)="searchTags($event)"
                  (focus)="onTagInputFocus()"
                  (blur)="onTagInputBlur()"
                  placeholder="Введите название тега или выберите из списка"
                  class="tag-input"
                  [ngModelOptions]="{standalone: true}"
                />
                <div class="tags-suggestions" *ngIf="tagSuggestions.length > 0 && showTagSuggestions" (mousedown)="$event.preventDefault()">
                  <div 
                    *ngFor="let tag of tagSuggestions; let i = index" 
                    class="tag-suggestion"
                    [class.selected]="i === selectedSuggestionIndex"
                    (click)="selectTag(tag)"
                    (mouseenter)="selectedSuggestionIndex = i"
                  >
                    <span class="tag-suggestion-icon">🏷️</span>
                    <span class="tag-suggestion-name">{{ tag.name }}</span>
                  </div>
                </div>
              </div>
              <div class="selected-tags" *ngIf="selectedTags.length > 0">
                <span 
                  *ngFor="let tag of selectedTags" 
                  class="badge bg-primary tag-badge"
                >
                  {{ tag.name }}
                  <button type="button" class="tag-remove" (click)="removeTag(tag)">×</button>
                </span>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="content">Содержимое *</label>
            <div #gjsEditor id="gjs-editor" style="min-height: 500px;"></div>

            <div *ngIf="articleForm.get('content')?.invalid && articleForm.get('content')?.touched" class="error-message">
              Содержимое обязательно
            </div>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" formControlName="is_published" />
              Опубликовано
            </label>
          </div>
          
          <div class="form-group" *ngIf="isEditMode">
            <label for="change_description">Описание изменений (опционально)</label>
            <textarea 
              id="change_description" 
              formControlName="change_description"
              rows="2"
              placeholder="Опишите, что было изменено в этой версии"
            ></textarea>
          </div>
          
          <div class="form-group" *ngIf="isEditMode && articleId">
            <label>Вложения к статье</label>
            <div class="attachments-section">
              <div class="attachment-upload">
                <input 
                  type="file" 
                  #attachmentInput
                  id="attachmentInput"
                  style="display: none"
                  (change)="onAttachmentFileSelected($event)"
                />
                <div class="upload-controls">
                  <button 
                    type="button" 
                    class="btn btn-sm btn-primary"
                    (click)="attachmentInput.click()"
                    [disabled]="uploadingAttachment"
                  >
                    {{ uploadingAttachment ? 'Загрузка...' : '📎 Загрузить файл' }}
                  </button>
                  <span class="file-size-hint">Максимальный размер: 50 МБ</span>
                </div>
                <div class="attachment-comment-input" *ngIf="selectedAttachmentFile">
                  <label for="attachment-comment">Комментарий к файлу (опционально):</label>
                  <textarea 
                    id="attachment-comment"
                    [(ngModel)]="attachmentComment"
                    [ngModelOptions]="{standalone: true}"
                    rows="2"
                    placeholder="Введите комментарий к файлу"
                    class="form-control"
                  ></textarea>
                  <div class="attachment-actions">
                    <button 
                      type="button" 
                      class="btn btn-sm btn-success"
                      (click)="uploadAttachment()"
                      [disabled]="uploadingAttachment"
                    >
                      Загрузить
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-sm btn-secondary"
                      (click)="cancelAttachmentUpload()"
                      [disabled]="uploadingAttachment"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
                <div *ngIf="attachmentUploadError" class="error-message">
                  {{ attachmentUploadError }}
                </div>
              </div>
              
              <div class="attachments-list" *ngIf="attachments && attachments.length > 0">
                <div class="attachment-item" *ngFor="let attachment of attachments">
                  <div class="attachment-info">
                    <a [href]="attachment.file_url" target="_blank" class="attachment-link">
                      <span class="attachment-icon">📎</span>
                      <span class="attachment-filename">{{ attachment.filename }}</span>
                    </a>
                    <div class="attachment-meta">
                      <span class="attachment-size">{{ attachment.file_size_display }}</span>
                      <span class="attachment-date">{{ attachment.uploaded_at | date:'dd.MM.yyyy, HH:mm' }}</span>
                      <span class="attachment-uploader">Загрузил: {{ attachment.uploaded_by_username }}</span>
                    </div>
                    <div class="attachment-comment" *ngIf="attachment.comment">
                      <strong>Комментарий:</strong> {{ attachment.comment }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="articleForm.invalid || saving">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </button>
            <button type="button" class="btn btn-secondary" (click)="cancel()">Отмена</button>
            <button type="button" class="btn btn-secondary" (click)="importWord()">Импорт из Word</button>
          </div>
        </div>
        
        <div *ngIf="error" class="error-message">{{ error }}</div>
      </form>
      
      <input 
        type="file" 
        #fileInput 
        accept=".doc,.docx" 
        style="display: none"
        (change)="onWordFileSelected($event)"
      />
      
    </div>
  `,
  styles: [`
    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    .error-message {
      color: #dc3545;
      font-size: 12px;
      margin-top: 5px;
    }
    input.error {
      border-color: #dc3545;
    }
    #gjs-editor {
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .tags-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .tags-input-wrapper {
      position: relative;
    }
    .tag-input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .tags-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-top: 2px;
    }
    .tag-suggestion {
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    }
    .tag-suggestion:hover {
      background-color: #f5f5f5;
    }
    .tag-suggestion:last-child {
      border-bottom: none;
    }
    .selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.35em 0.65em;
      font-size: 0.875em;
      font-weight: 500;
    }
    .tag-remove {
      background: rgba(255, 255, 255, 0.3);
      border: none;
      color: white;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
      margin-left: 4px;
    }
    .tag-remove:hover {
      background: rgba(255, 255, 255, 0.5);
    }
    .tag-suggestion-icon {
      margin-right: 8px;
      font-size: 14px;
    }
    .tag-suggestion-name {
      flex: 1;
    }
    .tag-suggestion.selected {
      background-color: #e3f2fd;
      color: #1976d2;
    }
    .options-table-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .options-table {
      margin-bottom: 0;
    }
    .options-table th {
      background-color: #f8f9fa;
      font-weight: 600;
      font-size: 13px;
    }
    .options-table td {
      vertical-align: middle;
      padding: 8px;
    }
    .add-option-btn {
      align-self: flex-start;
    }
    .attachments-section {
      margin-top: 10px;
    }
    .attachment-upload {
      margin-bottom: 20px;
    }
    .upload-controls {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
    }
    .file-size-hint {
      font-size: 0.9em;
      color: #666;
    }
    .attachment-comment-input {
      margin-top: 15px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    .attachment-comment-input label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .attachment-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 20px;
    }
    .attachment-item {
      padding: 15px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background-color: #f8f9fa;
    }
    .attachment-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .attachment-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
      font-size: 1.1em;
    }
    .attachment-link:hover {
      text-decoration: underline;
    }
    .attachment-icon {
      font-size: 1.2em;
    }
    .attachment-meta {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #666;
    }
    .attachment-comment {
      margin-top: 8px;
      padding: 8px;
      background-color: #ffffff;
      border-left: 3px solid #007bff;
      font-size: 0.95em;
    }
  `]
})
export class ArticleEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput: any;
  @ViewChild('attachmentInput') attachmentInput: any;
  @ViewChild('gjsEditor', { static: false }) gjsEditor!: ElementRef;
  
  articleForm: FormGroup;
  isEditMode = false;
  articleId: string | null = null;
  saving = false;
  error: string | null = null;
  categories: Category[] = [];
  tags: Tag[] = [];
  selectedTags: Tag[] = [];
  tagSuggestions: Tag[] = [];
  showTagSuggestions = false;
  newTagName = '';
  selectedSuggestionIndex = -1;
  editor: any = null;
  options: ArticleOption[] = [];
  optionValuesList: Array<{ id?: string; option_id: string | null; value: string }> = [];
  attachments: ArticleAttachment[] = [];
  selectedAttachmentFile: File | null = null;
  attachmentComment: string = '';
  uploadingAttachment = false;
  attachmentUploadError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
    private authService: AuthService
  ) {
    this.articleForm = this.fb.group({
      title: ['', Validators.required],
      summary: [''],
      category_id: [null],
      tag_ids: [[]],
      content: ['', Validators.required],
      is_published: [false],
      change_description: [''],
      option_values_data: [[]]
    });
  }

  ngOnInit(): void {
    // Проверяем, находимся ли мы на странице создания статьи из категории
    const url = this.router.url;
    const categoryMatch = url.match(/\/categories\/([^\/]+)\/articles\/new/);
    const categoryId = categoryMatch ? categoryMatch[1] : null;
    
    // Проверяем, редактируем ли мы существующую статью
    const articleIdMatch = url.match(/\/articles\/([^\/]+)\/edit/);
    const id = articleIdMatch ? articleIdMatch[1] : null;
    
    if (id) {
      this.isEditMode = true;
      this.articleId = id;
    }
    
    // Загружаем категории сначала, затем статью (если редактирование)
    this.loadCategories().subscribe({
      next: (categories) => {
        // Убеждаемся, что categories - это массив
        this.categories = Array.isArray(categories) ? categories : [];
        
        // Если это создание новой статьи и указана категория в URL
        if (!this.isEditMode && categoryId) {
          const category = this.categories.find(c => c.id === categoryId);
          if (category) {
            this.articleForm.patchValue({ category_id: categoryId });
          }
        }
        
        // После загрузки категорий загружаем теги, опции и статью, если это режим редактирования
        this.loadTags();
        this.loadOptions();
        if (id) {
          this.loadArticle(id);
        }
      },
      error: () => {
        this.categories = []; // Устанавливаем пустой массив при ошибке
        // Все равно загружаем статью, даже если категории не загрузились
        this.loadTags();
        if (id) {
          this.loadArticle(id);
        }
      }
    });
  }

  loadTags(): void {
    this.articleService.getTags().subscribe({
      next: (tags) => {
        this.tags = Array.isArray(tags) ? tags : [];
      },
      error: () => {
        this.tags = [];
      }
    });
  }

  loadOptions(): void {
    this.articleService.getOptions().subscribe({
      next: (options) => {
        this.options = Array.isArray(options) ? options : [];
      },
      error: () => {
        this.options = [];
      }
    });
  }

  addOptionValue(): void {
    this.optionValuesList.push({
      option_id: null,
      value: ''
    });
  }

  removeOptionValue(index: number): void {
    this.optionValuesList.splice(index, 1);
  }

  getAvailableOptions(currentOptionId: string | null, currentIndex: number): ArticleOption[] {
    // Возвращаем все опции, кроме тех, которые уже выбраны в других строках
    const selectedOptionIds = this.optionValuesList
      .map((ov, idx) => idx !== currentIndex ? ov.option_id : null)
      .filter(id => id !== null) as string[];
    
    return this.options.filter(option => 
      !selectedOptionIds.includes(option.id) || option.id === currentOptionId
    );
  }

  onTagInputFocus(): void {
    // При фокусе показываем все доступные теги, если поле пустое
    if (this.newTagName.trim().length === 0) {
      this.showAllAvailableTags();
    } else if (this.tagSuggestions.length > 0) {
      this.showTagSuggestions = true;
    }
  }

  onTagInputBlur(): void {
    // Задержка, чтобы клик по подсказке успел сработать
    setTimeout(() => {
      this.showTagSuggestions = false;
      this.selectedSuggestionIndex = -1;
    }, 200);
  }

  showAllAvailableTags(): void {
    // Показываем все теги из базы, кроме уже выбранных (включая временные)
    this.tagSuggestions = this.tags.filter(tag => {
      if (!tag.id) return false; // Пропускаем теги без id
      // Проверяем, не выбран ли уже этот тег (по id или по имени для временных)
      return !this.selectedTags.some(selected => {
        if (selected.id && tag.id) {
          return selected.id === tag.id;
        }
        return selected.name.toLowerCase() === tag.name.toLowerCase();
      });
    });
    this.showTagSuggestions = this.tagSuggestions.length > 0;
    this.selectedSuggestionIndex = -1;
  }

  searchTags(event: any): void {
    const searchTerm = event.target.value.trim();
    this.newTagName = searchTerm;
    this.selectedSuggestionIndex = -1;
    
    if (searchTerm.length > 0) {
      this.articleService.getTags(searchTerm).subscribe({
        next: (tags) => {
          const tagArray = Array.isArray(tags) ? tags : [];
          // Фильтруем теги, которые уже выбраны (включая временные)
          this.tagSuggestions = tagArray.filter(tag => {
            if (!tag.id) return false;
            return !this.selectedTags.some(selected => {
              if (selected.id && tag.id) {
                return selected.id === tag.id;
              }
              return selected.name.toLowerCase() === tag.name.toLowerCase();
            });
          });
          this.showTagSuggestions = this.tagSuggestions.length > 0;
        },
        error: () => {
          this.tagSuggestions = [];
          this.showTagSuggestions = false;
        }
      });
    } else {
      // Если поле пустое, показываем все доступные теги
      this.showAllAvailableTags();
    }
  }

  navigateSuggestions(event: Event, direction: number): void {
    event.preventDefault();
    if (this.tagSuggestions.length === 0) {
      return;
    }
    
    this.selectedSuggestionIndex += direction;
    
    if (this.selectedSuggestionIndex < 0) {
      this.selectedSuggestionIndex = this.tagSuggestions.length - 1;
    } else if (this.selectedSuggestionIndex >= this.tagSuggestions.length) {
      this.selectedSuggestionIndex = 0;
    }
    
    // Прокручиваем к выбранному элементу
    const suggestionsElement = document.querySelector('.tags-suggestions');
    if (suggestionsElement) {
      const selectedElement = suggestionsElement.children[this.selectedSuggestionIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  hideSuggestions(): void {
    this.showTagSuggestions = false;
    this.selectedSuggestionIndex = -1;
  }

  selectTag(tag: Tag): void {
    // Проверяем, не добавлен ли уже такой тег
    const exists = this.selectedTags.some(t => {
      // Если оба имеют id, сравниваем по id
      if (t.id && tag.id) {
        return t.id === tag.id;
      }
      // Иначе сравниваем по имени (без учета регистра)
      return t.name.toLowerCase() === tag.name.toLowerCase();
    });
    
    if (!exists) {
      this.selectedTags.push(tag);
      this.updateTagIds();
    }
    this.newTagName = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
    this.selectedSuggestionIndex = -1;
  }

  addNewTag(event: Event): void {
    event.preventDefault();
    
    // Если есть выбранная подсказка, выбираем её
    if (this.selectedSuggestionIndex >= 0 && this.selectedSuggestionIndex < this.tagSuggestions.length) {
      this.selectTag(this.tagSuggestions[this.selectedSuggestionIndex]);
      return;
    }
    
    const tagName = this.newTagName.trim();
    
    if (tagName.length === 0) {
      return;
    }
    
    // Проверяем, не существует ли уже такой тег в базе
    const existingTag = this.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      this.selectTag(existingTag);
      return;
    }
    
    // Проверяем, не добавлен ли уже такой тег в выбранные (новый временный)
    const alreadySelected = this.selectedTags.find(t => 
      (!t.id || t.id.startsWith('temp-')) && t.name.toLowerCase() === tagName.toLowerCase()
    );
    if (alreadySelected) {
      this.newTagName = '';
      this.tagSuggestions = [];
      this.showTagSuggestions = false;
      this.selectedSuggestionIndex = -1;
      return;
    }
    
    // Создаем временный тег (без сохранения в БД)
    const tempTag: Tag = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: tagName,
      slug: tagName.toLowerCase().replace(/\s+/g, '-'),
    };
    
    this.selectTag(tempTag);
  }

  removeTag(tag: Tag): void {
    this.selectedTags = this.selectedTags.filter(t => t.id !== tag.id);
    this.updateTagIds();
  }

  updateTagIds(): void {
    // Собираем только id существующих тегов (не временных)
    const tagIds = this.selectedTags
      .filter(tag => tag.id && !tag.id.startsWith('temp-'))
      .map(tag => tag.id!);
    this.articleForm.patchValue({ tag_ids: tagIds });
  }

  loadCategories(): Observable<Category[]> {
    return this.articleService.getCategories().pipe(
      map(categories => {
        // Убеждаемся, что возвращается массив
        if (Array.isArray(categories)) {
          return categories;
        }
        // Если ответ в формате { results: [...] } или другом
        if (categories && typeof categories === 'object' && 'results' in categories) {
          return (categories as any).results;
        }
        // Если это объект, преобразуем в массив
        if (categories && typeof categories === 'object') {
          return Object.values(categories);
        }
        return [];
      })
    );
  }

  compareCategory(cat1: string | null, cat2: string | null): boolean {
    // Приводим к строкам для сравнения, чтобы избежать проблем с типами
    const str1 = cat1 ? String(cat1) : null;
    const str2 = cat2 ? String(cat2) : null;
    
    if (str1 === null && str2 === null) return true;
    if (str1 === null || str2 === null) return false;
    return str1 === str2;
  }

  trackByCategoryId(index: number, category: Category): string {
    return category.id;
  }

  ngAfterViewInit(): void {
    this.initStudioEditor();
  }

  ngOnDestroy(): void {
    if (this.editor && typeof this.editor.destroy === 'function') {
      this.editor.destroy();
    }
  }

  async initStudioEditor(): Promise<void> {
    if (!this.gjsEditor || !this.gjsEditor.nativeElement) {
      setTimeout(() => this.initStudioEditor(), 100);
      return;
    }

    // Убеждаемся, что контейнер готов
    const container = this.gjsEditor.nativeElement;
    if (!container || !container.parentElement) {
      setTimeout(() => this.initStudioEditor(), 100);
      return;
    }

    // Проверяем, что элемент существует в DOM
    const containerElement = document.getElementById('gjs-editor');
    if (!containerElement) {
      setTimeout(() => this.initStudioEditor(), 100);
      return;
    }

    try {
      // Проверяем, что GrapesJS доступен
      const gjs = (grapesjs as any).default || grapesjs;
      
      if (!gjs || typeof gjs.init !== 'function') {
        this.error = 'Ошибка загрузки редактора. GrapesJS недоступен.';
        return;
      }

      // Сначала инициализируем редактор без плагина
      this.editor = gjs.init({
        container: containerElement,
        height: '500px',
        canvas: {
          styles: []
        },
        storageManager: {
          type: 'local',
          autosave: true,
          autoload: false,
          stepsBeforeSave: 1
        },
        // Настройки для сохранения ID компонентов
        // GrapesJS должен сохранять существующие ID из HTML
        avoidInlineStyle: false,
        plugins: [],
        pluginsOpts: {}
      });

      // Плагин grapesjs-table отключен из-за несовместимости с GrapesJS 0.22.13
      // Плагин пытается изменить readonly свойство 'defaults', что вызывает ошибку
      // Вместо плагина используются встроенные блоки таблиц Bootstrap (см. метод addBootstrapBlocks)
      // Если в будущем появится совместимая версия плагина, можно будет включить его здесь
      /*
      try {
        const tableModule = await import('grapesjs-table');
        const grapesjsTable = (tableModule as any).default || tableModule;
        if (grapesjsTable && typeof grapesjsTable === 'function') {
          grapesjsTable(this.editor, {
            classTable: 'table',
            tableBlock: {
              label: 'Таблица (плагин)',
              attributes: { class: 'gjs-block' }
            },
            tableProps: {
              name: 'Table',
              droppable: true
            }
          });
        }
      } catch (pluginError: any) {
        // Плагин grapesjs-table несовместим с текущей версией GrapesJS
      }
      */

        // Функция для добавления стилей layout блоков в редакторе
        const addLayoutStyles = (canvasDoc: Document) => {
          const layoutStyles = canvasDoc.createElement('style');
          layoutStyles.id = 'gjs-layout-styles';
          layoutStyles.textContent = `
            /* Переопределение стилей body для корректного отображения в редакторе */
            body {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            * {
              box-sizing: border-box;
            }
            /* Стили для layout блоков только в редакторе */
            .container,
            .container-fluid {
              padding-top: 15px;
              padding-bottom: 15px;
              background-color: rgba(0, 123, 255, 0.05);
              border: 1px dashed rgba(0, 123, 255, 0.3);
              position: relative;
              min-height: 50px;
            }
            
            .container::before,
            .container-fluid::before {
              content: 'Container';
              position: absolute;
              top: 5px;
              left: 5px;
              font-size: 11px;
              color: rgba(0, 123, 255, 0.6);
              font-weight: 600;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 1;
            }
            
            .container-fluid::before {
              content: 'Container Fluid';
            }
            
            .row {
              padding-top: 10px;
              padding-bottom: 10px;
              background-color: rgba(40, 167, 69, 0.05);
              border: 1px dashed rgba(40, 167, 69, 0.3);
              position: relative;
              min-height: 40px;
              margin: 5px 0;
            }
            
            .row::before {
              content: 'Row';
              position: absolute;
              top: 3px;
              left: 5px;
              font-size: 11px;
              color: rgba(40, 167, 69, 0.6);
              font-weight: 600;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 1;
            }
            
            .col,
            .col-auto,
            .col-1, .col-2, .col-3, .col-4, .col-5, .col-6,
            .col-7, .col-8, .col-9, .col-10, .col-11, .col-12 {
              padding-top: 10px;
              padding-bottom: 10px;
              background-color: rgba(255, 193, 7, 0.08);
              border: 1px dashed rgba(255, 193, 7, 0.4);
              position: relative;
              min-height: 30px;
              margin-top: 3px;
              margin-bottom: 3px;
            }
            
            .col::before,
            .col-auto::before,
            .col-1::before, .col-2::before, .col-3::before, .col-4::before,
            .col-5::before, .col-6::before, .col-7::before, .col-8::before,
            .col-9::before, .col-10::before, .col-11::before, .col-12::before {
              content: attr(class);
              position: absolute;
              top: 2px;
              left: 5px;
              font-size: 10px;
              color: rgba(255, 193, 7, 0.7);
              font-weight: 600;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 1;
              max-width: calc(100% - 10px);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            /* Hover эффект для layout блоков */
            .container:hover,
            .container-fluid:hover {
              background-color: rgba(0, 123, 255, 0.1);
              border-color: rgba(0, 123, 255, 0.5);
            }
            
            .row:hover {
              background-color: rgba(40, 167, 69, 0.1);
              border-color: rgba(40, 167, 69, 0.5);
            }
            
            .col:hover,
            .col-auto:hover,
            .col-1:hover, .col-2:hover, .col-3:hover, .col-4:hover,
            .col-5:hover, .col-6:hover, .col-7:hover, .col-8:hover,
            .col-9:hover, .col-10:hover, .col-11:hover, .col-12:hover {
              background-color: rgba(255, 193, 7, 0.15);
              border-color: rgba(255, 193, 7, 0.6);
            }
          `;
          // Проверяем, не добавлены ли уже стили
          if (!canvasDoc.getElementById('gjs-layout-styles')) {
            canvasDoc.head.appendChild(layoutStyles);
          }
        };

        // Добавляем Bootstrap CSS в редактор после инициализации
        setTimeout(() => {
          try {
            if (this.editor && this.editor.Canvas) {
              const canvas = this.editor.Canvas.getFrameEl();
              if (canvas && canvas.contentDocument) {
                // Пытаемся получить Bootstrap CSS из уже загруженных стилей на странице
                let bootstrapCss = '';
                
                try {
                  const bootstrapStyles = Array.from(document.styleSheets)
                    .find(sheet => {
                      try {
                        return sheet.href && sheet.href.includes('bootstrap');
                      } catch {
                        return false;
                      }
                    });
                  
                  if (bootstrapStyles) {
                    const rules = Array.from(bootstrapStyles.cssRules || []);
                    bootstrapCss = rules.map(rule => rule.cssText).join('\n');
                  }
                } catch (e) {
                  // Не удалось получить Bootstrap CSS из styleSheets
                }
                
                // Если не удалось получить из styleSheets, используем CDN
                if (!bootstrapCss) {
                  fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css')
                    .then(response => response.text())
                    .then(cssText => {
                      const style = canvas.contentDocument!.createElement('style');
                      style.textContent = cssText;
                      canvas.contentDocument!.head.appendChild(style);
                      // Добавляем стили layout после загрузки Bootstrap CSS
                      addLayoutStyles(canvas.contentDocument!);
                    })
                    .catch(() => {
                      // Fallback: добавляем link на CDN
                      const link = canvas.contentDocument!.createElement('link');
                      link.rel = 'stylesheet';
                      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css';
                      canvas.contentDocument!.head.appendChild(link);
                      // Добавляем стили layout после добавления link
                      link.onload = () => {
                        addLayoutStyles(canvas.contentDocument!);
                      };
                      // Если onload не сработает, добавляем с задержкой
                      setTimeout(() => {
                        addLayoutStyles(canvas.contentDocument!);
                      }, 500);
                    });
                } else {
                  // Добавляем полученный CSS
                  const style = canvas.contentDocument.createElement('style');
                  style.textContent = bootstrapCss;
                  canvas.contentDocument.head.appendChild(style);
                  // Добавляем стили layout после добавления Bootstrap CSS
                  addLayoutStyles(canvas.contentDocument);
                }
              }
            }
          } catch (error) {
            // Ошибка при добавлении Bootstrap CSS
          }
        }, 300);

        // Добавляем Bootstrap блоки после инициализации
        setTimeout(() => {
          this.addBootstrapBlocks();
        }, 400);

        // Настройка загрузки изображений через Asset Manager после инициализации
        setTimeout(() => {
          try {
            const assetManager = this.editor?.AssetManager;
            if (assetManager) {
              // Переопределяем метод загрузки
              const originalUpload = assetManager.upload;
              if (originalUpload) {
                assetManager.upload = (files: File[]) => {
                  if (!this.articleId) {
                    this.error = 'Сначала сохраните статью, чтобы загружать изображения';
                    return Promise.reject(new Error('Статья должна быть сохранена перед загрузкой изображений'));
                  }
                  
                  const uploadPromises = files.map(file => {
                    return new Promise((resolve, reject) => {
                      this.articleService.uploadImage(this.articleId!, file).subscribe({
                        next: (image) => {
                          // Добавляем изображение в Asset Manager
                          if (assetManager && typeof assetManager.add === 'function') {
                            assetManager.add({
                              src: image.image_url,
                              type: 'image'
                            });
                          }
                          resolve({
                            src: image.image_url,
                            type: 'image'
                          });
                        },
                        error: (err) => {
                          this.error = 'Ошибка загрузки изображения';
                          reject(err);
                        }
                      });
                    });
                  });
                  
                  return Promise.all(uploadPromises);
                };
              }
            }
          } catch (error) {
            // Не удалось настроить Asset Manager
          }
        }, 200);

        // Функция для синхронизации контента с формой
        const syncContent = () => {
          if (this.editor) {
            try {
              const html = this.editor.getHtml ? this.editor.getHtml() : '';
              const css = this.editor.getCss ? this.editor.getCss() : '';
              const content = `<style>${css}</style>${html}`;
              this.articleForm.patchValue({ content }, { emitEvent: false });
            } catch (error) {
              // Ошибка синхронизации контента
            }
          }
        };

        // Синхронизируем изменения редактора с формой
        if (this.editor && typeof this.editor.on === 'function') {
          // Обновление компонентов
          this.editor.on('update', syncContent);
          
          // Обновление стилей через Style Manager
          this.editor.on('style:custom', syncContent);
          this.editor.on('component:styleUpdate', syncContent);
          this.editor.on('style:property:update', syncContent);
          
          // Обновление при изменении CSS
          this.editor.on('css:update', syncContent);
        }

        // Загружаем контент, если он уже есть в форме
        const currentContent = this.articleForm.get('content')?.value;
        if (currentContent) {
          setTimeout(() => {
            this.loadContentToEditor(currentContent);
          }, 500);
        }
    } catch (error) {
      this.error = 'Ошибка загрузки редактора. Попробуйте обновить страницу.';
    }
  }


  addBootstrapBlocks(): void {
    if (!this.editor || !this.editor.BlockManager) {
      return;
    }

    const blockManager = this.editor.BlockManager;

    // Функция для генерации placeholder изображения (SVG data URL)
    const getPlaceholderImage = (width: number = 300, height: number = 200): string => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="#e9ecef"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#6c757d" text-anchor="middle" dy=".3em">${width}×${height}</text>
      </svg>`;
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    };

    // Функция для получения SVG иконок
    const getIcon = (iconName: string): string => {
      const icons: { [key: string]: string } = {
        container: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
        row: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
        col: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="16" y2="21"/><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="11" y="3" width="5" height="18" rx="1"/><rect x="19" y="3" width="5" height="18" rx="1"/></svg>',
        heading: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h6v6H6V4zm0 10h6v6H6v-6zm12-10h-6v6h6V4zm-6 10h6v6h-6v-6z"/></svg>',
        paragraph: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
        list: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
        quote: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
        button: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>',
        table: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="3"/></svg>',
        card: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/></svg>',
        alert: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        badge: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
        form: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>',
        image: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
      };
      return icons[iconName] || icons['container'];
    };

    // Layout - Container
    blockManager.add('container', {
      label: 'Container',
      category: 'Layout',
      content: '<div class="container"><p>Содержимое контейнера</p></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('container')
    });

    blockManager.add('container-fluid', {
      label: 'Container Fluid',
      category: 'Layout',
      content: '<div class="container-fluid"><p>Содержимое контейнера (на всю ширину)</p></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('container')
    });

    // Layout - Row с различными комбинациями колонок
    blockManager.add('row-12', {
      label: 'Row 12',
      category: 'Layout',
      content: '<div class="row"><div class="col-12"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-6-6', {
      label: 'Row 6-6',
      category: 'Layout',
      content: '<div class="row"><div class="col-6"></div><div class="col-6"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-4-4-4', {
      label: 'Row 4-4-4',
      category: 'Layout',
      content: '<div class="row"><div class="col-4"></div><div class="col-4"></div><div class="col-4"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-3-3-3-3', {
      label: 'Row 3-3-3-3',
      category: 'Layout',
      content: '<div class="row"><div class="col-3"></div><div class="col-3"></div><div class="col-3"></div><div class="col-3"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-4-8', {
      label: 'Row 4-8',
      category: 'Layout',
      content: '<div class="row"><div class="col-4"></div><div class="col-8"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-8-4', {
      label: 'Row 8-4',
      category: 'Layout',
      content: '<div class="row"><div class="col-8"></div><div class="col-4"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-3-9', {
      label: 'Row 3-9',
      category: 'Layout',
      content: '<div class="row"><div class="col-3"></div><div class="col-9"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-9-3', {
      label: 'Row 9-3',
      category: 'Layout',
      content: '<div class="row"><div class="col-9"></div><div class="col-3"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-10', {
      label: 'Row 2-10',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-10"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-10-2', {
      label: 'Row 10-2',
      category: 'Layout',
      content: '<div class="row"><div class="col-10"></div><div class="col-2"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-6-3-3', {
      label: 'Row 6-3-3',
      category: 'Layout',
      content: '<div class="row"><div class="col-6"></div><div class="col-3"></div><div class="col-3"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-3-6-3', {
      label: 'Row 3-6-3',
      category: 'Layout',
      content: '<div class="row"><div class="col-3"></div><div class="col-6"></div><div class="col-3"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-5-7', {
      label: 'Row 5-7',
      category: 'Layout',
      content: '<div class="row"><div class="col-5"></div><div class="col-7"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-7-5', {
      label: 'Row 7-5',
      category: 'Layout',
      content: '<div class="row"><div class="col-7"></div><div class="col-5"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-1-11', {
      label: 'Row 1-11',
      category: 'Layout',
      content: '<div class="row"><div class="col-1"></div><div class="col-11"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-11-1', {
      label: 'Row 11-1',
      category: 'Layout',
      content: '<div class="row"><div class="col-11"></div><div class="col-1"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-2-8', {
      label: 'Row 2-2-8',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-2"></div><div class="col-8"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-8-2-2', {
      label: 'Row 8-2-2',
      category: 'Layout',
      content: '<div class="row"><div class="col-8"></div><div class="col-2"></div><div class="col-2"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-4-6', {
      label: 'Row 2-4-6',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-4"></div><div class="col-6"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-6-4-2', {
      label: 'Row 6-4-2',
      category: 'Layout',
      content: '<div class="row"><div class="col-6"></div><div class="col-4"></div><div class="col-2"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-2-2-6', {
      label: 'Row 2-2-2-6',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-2"></div><div class="col-2"></div><div class="col-6"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-6-2-2-2', {
      label: 'Row 6-2-2-2',
      category: 'Layout',
      content: '<div class="row"><div class="col-6"></div><div class="col-2"></div><div class="col-2"></div><div class="col-2"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-3-7', {
      label: 'Row 2-3-7',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-3"></div><div class="col-7"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-7-3-2', {
      label: 'Row 7-3-2',
      category: 'Layout',
      content: '<div class="row"><div class="col-7"></div><div class="col-3"></div><div class="col-2"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    blockManager.add('row-2-2-4-4', {
      label: 'Row 2-2-4-4',
      category: 'Layout',
      content: '<div class="row"><div class="col-2"></div><div class="col-2"></div><div class="col-4"></div><div class="col-4"></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('row')
    });

    // Typography - Headings
    blockManager.add('h1', {
      label: 'Заголовок H1',
      category: 'Typography - Headings',
      content: '<h1>Заголовок 1</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('h2', {
      label: 'Заголовок H2',
      category: 'Typography - Headings',
      content: '<h2>Заголовок 2</h2>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('h3', {
      label: 'Заголовок H3',
      category: 'Typography - Headings',
      content: '<h3>Заголовок 3</h3>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('h4', {
      label: 'Заголовок H4',
      category: 'Typography - Headings',
      content: '<h4>Заголовок 4</h4>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('h5', {
      label: 'Заголовок H5',
      category: 'Typography - Headings',
      content: '<h5>Заголовок 5</h5>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('h6', {
      label: 'Заголовок H6',
      category: 'Typography - Headings',
      content: '<h6>Заголовок 6</h6>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-1', {
      label: 'Display 1',
      category: 'Typography - Headings',
      content: '<h1 class="display-1">Display 1</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-2', {
      label: 'Display 2',
      category: 'Typography - Headings',
      content: '<h1 class="display-2">Display 2</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-3', {
      label: 'Display 3',
      category: 'Typography - Headings',
      content: '<h1 class="display-3">Display 3</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-4', {
      label: 'Display 4',
      category: 'Typography - Headings',
      content: '<h1 class="display-4">Display 4</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-5', {
      label: 'Display 5',
      category: 'Typography - Headings',
      content: '<h1 class="display-5">Display 5</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    blockManager.add('display-6', {
      label: 'Display 6',
      category: 'Typography - Headings',
      content: '<h1 class="display-6">Display 6</h1>',
      attributes: { class: 'gjs-block' },
      media: getIcon('heading')
    });

    // Typography - Text Elements
    blockManager.add('paragraph', {
      label: 'Параграф',
      category: 'Typography - Text Elements',
      content: '<p>Текст параграфа</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('lead', {
      label: 'Lead (выделенный текст)',
      category: 'Typography - Text Elements',
      content: '<p class="lead">Выделенный текст параграфа</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('mark', {
      label: 'Mark (выделение)',
      category: 'Typography - Text Elements',
      content: '<p>Текст с <mark>выделенным</mark> фрагментом</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('small', {
      label: 'Small (маленький текст)',
      category: 'Typography - Text Elements',
      content: '<p>Обычный текст <small>маленький текст</small></p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('del', {
      label: 'Del (удаленный текст)',
      category: 'Typography - Text Elements',
      content: '<p>Текст с <del>удаленным</del> фрагментом</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('s', {
      label: 'S (зачеркнутый текст)',
      category: 'Typography - Text Elements',
      content: '<p>Текст с <s>зачеркнутым</s> фрагментом</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('ins', {
      label: 'Ins (вставленный текст)',
      category: 'Typography - Text Elements',
      content: '<p>Текст с <ins>вставленным</ins> фрагментом</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('u', {
      label: 'U (подчеркнутый текст)',
      category: 'Typography - Text Elements',
      content: '<p>Текст с <u>подчеркнутым</u> фрагментом</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('abbr', {
      label: 'Abbr (сокращение)',
      category: 'Typography - Text Elements',
      content: '<p><abbr title="HyperText Markup Language">HTML</abbr> - это язык разметки</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('code', {
      label: 'Code (код)',
      category: 'Typography - Text Elements',
      content: '<p>Используйте <code>&lt;code&gt;</code> для кода</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('code-block', {
      label: 'Code Block (блок кода)',
      category: 'Typography - Text Elements',
      content: '<pre><code>&lt;p&gt;Пример кода&lt;/p&gt;</code></pre>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('kbd', {
      label: 'Kbd (клавиша)',
      category: 'Typography - Text Elements',
      content: '<p>Нажмите <kbd>Ctrl</kbd> + <kbd>C</kbd> для копирования</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('samp', {
      label: 'Samp (пример вывода)',
      category: 'Typography - Text Elements',
      content: '<p>Пример вывода: <samp>Hello, World!</samp></p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('var', {
      label: 'Var (переменная)',
      category: 'Typography - Text Elements',
      content: '<p>Переменная <var>x</var> = 10</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    // Typography - Lists
    blockManager.add('ul', {
      label: 'Маркированный список',
      category: 'Typography - Lists',
      content: '<ul><li>Элемент списка 1</li><li>Элемент списка 2</li><li>Элемент списка 3</li></ul>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    blockManager.add('ol', {
      label: 'Нумерованный список',
      category: 'Typography - Lists',
      content: '<ol><li>Элемент списка 1</li><li>Элемент списка 2</li><li>Элемент списка 3</li></ol>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    blockManager.add('list-unstyled', {
      label: 'Список без стилей',
      category: 'Typography - Lists',
      content: '<ul class="list-unstyled"><li>Элемент 1</li><li>Элемент 2</li><li>Элемент 3</li></ul>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    blockManager.add('list-inline', {
      label: 'Инлайн список',
      category: 'Typography - Lists',
      content: '<ul class="list-inline"><li class="list-inline-item">Элемент 1</li><li class="list-inline-item">Элемент 2</li><li class="list-inline-item">Элемент 3</li></ul>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    blockManager.add('dl', {
      label: 'Описательный список',
      category: 'Typography - Lists',
      content: '<dl><dt>Термин 1</dt><dd>Описание термина 1</dd><dt>Термин 2</dt><dd>Описание термина 2</dd></dl>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    blockManager.add('dl-horizontal', {
      label: 'Горизонтальный описательный список',
      category: 'Typography - Lists',
      content: '<dl class="row"><dt class="col-sm-3">Термин 1</dt><dd class="col-sm-9">Описание термина 1</dd><dt class="col-sm-3">Термин 2</dt><dd class="col-sm-9">Описание термина 2</dd></dl>',
      attributes: { class: 'gjs-block' },
      media: getIcon('list')
    });

    // Typography - Blockquotes
    blockManager.add('blockquote', {
      label: 'Цитата',
      category: 'Typography - Blockquotes',
      content: '<blockquote class="blockquote"><p>Текст цитаты</p></blockquote>',
      attributes: { class: 'gjs-block' },
      media: getIcon('quote')
    });

    blockManager.add('blockquote-footer', {
      label: 'Цитата с источником',
      category: 'Typography - Blockquotes',
      content: '<blockquote class="blockquote"><p>Текст цитаты</p><footer class="blockquote-footer">Источник цитаты</footer></blockquote>',
      attributes: { class: 'gjs-block' },
      media: getIcon('quote')
    });

    blockManager.add('blockquote-reverse', {
      label: 'Цитата справа',
      category: 'Typography - Blockquotes',
      content: '<figure class="text-end"><blockquote class="blockquote"><p>Текст цитаты</p></blockquote><figcaption class="blockquote-footer">Источник цитаты</figcaption></figure>',
      attributes: { class: 'gjs-block' },
      media: getIcon('quote')
    });

    // Typography - Text Utilities
    blockManager.add('text-muted', {
      label: 'Текст Muted',
      category: 'Typography - Text Utilities',
      content: '<p class="text-muted">Приглушенный текст</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-primary', {
      label: 'Текст Primary',
      category: 'Typography - Text Utilities',
      content: '<p class="text-primary">Текст Primary цвета</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-success', {
      label: 'Текст Success',
      category: 'Typography - Text Utilities',
      content: '<p class="text-success">Текст Success цвета</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-danger', {
      label: 'Текст Danger',
      category: 'Typography - Text Utilities',
      content: '<p class="text-danger">Текст Danger цвета</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-warning', {
      label: 'Текст Warning',
      category: 'Typography - Text Utilities',
      content: '<p class="text-warning">Текст Warning цвета</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-info', {
      label: 'Текст Info',
      category: 'Typography - Text Utilities',
      content: '<p class="text-info">Текст Info цвета</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-center', {
      label: 'Текст по центру',
      category: 'Typography - Text Utilities',
      content: '<p class="text-center">Текст, выровненный по центру</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-start', {
      label: 'Текст слева',
      category: 'Typography - Text Utilities',
      content: '<p class="text-start">Текст, выровненный слева</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-end', {
      label: 'Текст справа',
      category: 'Typography - Text Utilities',
      content: '<p class="text-end">Текст, выровненный справа</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-uppercase', {
      label: 'Текст заглавными',
      category: 'Typography - Text Utilities',
      content: '<p class="text-uppercase">Текст заглавными буквами</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-lowercase', {
      label: 'Текст строчными',
      category: 'Typography - Text Utilities',
      content: '<p class="text-lowercase">Текст строчными буквами</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('text-capitalize', {
      label: 'Текст с заглавной',
      category: 'Typography - Text Utilities',
      content: '<p class="text-capitalize">текст с заглавной буквы</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('fw-bold', {
      label: 'Жирный текст',
      category: 'Typography - Text Utilities',
      content: '<p class="fw-bold">Жирный текст</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('fw-normal', {
      label: 'Обычный вес',
      category: 'Typography - Text Utilities',
      content: '<p class="fw-normal">Текст обычного веса</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('fw-light', {
      label: 'Легкий текст',
      category: 'Typography - Text Utilities',
      content: '<p class="fw-light">Легкий текст</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('fst-italic', {
      label: 'Курсив',
      category: 'Typography - Text Utilities',
      content: '<p class="fst-italic">Курсивный текст</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('fst-normal', {
      label: 'Обычный стиль',
      category: 'Typography - Text Utilities',
      content: '<p class="fst-normal">Текст обычного стиля</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    // Buttons - Primary варианты
    blockManager.add('btn-primary', {
      label: 'Кнопка Primary',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-primary">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-secondary', {
      label: 'Кнопка Secondary',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-secondary">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-success', {
      label: 'Кнопка Success',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-success">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-danger', {
      label: 'Кнопка Danger',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-danger">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-warning', {
      label: 'Кнопка Warning',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-warning">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-info', {
      label: 'Кнопка Info',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-info">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-light', {
      label: 'Кнопка Light',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-light">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-dark', {
      label: 'Кнопка Dark',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-dark">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    // Buttons - Outline варианты
    blockManager.add('btn-outline-primary', {
      label: 'Кнопка Outline Primary',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-primary">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-secondary', {
      label: 'Кнопка Outline Secondary',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-secondary">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-success', {
      label: 'Кнопка Outline Success',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-success">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-danger', {
      label: 'Кнопка Outline Danger',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-danger">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-warning', {
      label: 'Кнопка Outline Warning',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-warning">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-info', {
      label: 'Кнопка Outline Info',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-info">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-light', {
      label: 'Кнопка Outline Light',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-light">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-outline-dark', {
      label: 'Кнопка Outline Dark',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-outline-dark">Кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    // Buttons - Размеры
    blockManager.add('btn-lg', {
      label: 'Кнопка Large',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-primary btn-lg">Большая кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    blockManager.add('btn-sm', {
      label: 'Кнопка Small',
      category: 'Buttons',
      content: '<button type="button" class="btn btn-primary btn-sm">Маленькая кнопка</button>',
      attributes: { class: 'gjs-block' },
      media: getIcon('button')
    });

    // Tables
    blockManager.add('table', {
      label: 'Таблица',
      category: 'Tables',
      content: '<table class="table"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    blockManager.add('table-striped', {
      label: 'Таблица Striped',
      category: 'Tables',
      content: '<table class="table table-striped"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    blockManager.add('table-bordered', {
      label: 'Таблица Bordered',
      category: 'Tables',
      content: '<table class="table table-bordered"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    blockManager.add('table-hover', {
      label: 'Таблица Hover',
      category: 'Tables',
      content: '<table class="table table-hover"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    blockManager.add('table-sm', {
      label: 'Таблица Small',
      category: 'Tables',
      content: '<table class="table table-sm"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    blockManager.add('table-dark', {
      label: 'Таблица Dark',
      category: 'Tables',
      content: '<table class="table table-dark"><thead><tr><th><div>Заголовок 1</div></th><th><div>Заголовок 2</div></th></tr></thead><tbody><tr><td><div>Ячейка 1</div></td><td><div>Ячейка 2</div></td></tr><tr><td><div>Ячейка 3</div></td><td><div>Ячейка 4</div></td></tr></tbody></table>',
      attributes: { class: 'gjs-block' },
      media: getIcon('table')
    });

    // Cards
    blockManager.add('card', {
      label: 'Карточка',
      category: 'Cards',
      content: '<div class="card"><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-header', {
      label: 'Карточка с заголовком',
      category: 'Cards',
      content: '<div class="card"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-footer', {
      label: 'Карточка с подвалом',
      category: 'Cards',
      content: '<div class="card"><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div><div class="card-footer">Подвал</div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-primary', {
      label: 'Карточка Primary',
      category: 'Cards',
      content: '<div class="card text-white bg-primary mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-secondary', {
      label: 'Карточка Secondary',
      category: 'Cards',
      content: '<div class="card text-white bg-secondary mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-success', {
      label: 'Карточка Success',
      category: 'Cards',
      content: '<div class="card text-white bg-success mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-danger', {
      label: 'Карточка Danger',
      category: 'Cards',
      content: '<div class="card text-white bg-danger mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-warning', {
      label: 'Карточка Warning',
      category: 'Cards',
      content: '<div class="card text-white bg-warning mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    blockManager.add('card-info', {
      label: 'Карточка Info',
      category: 'Cards',
      content: '<div class="card text-white bg-info mb-3"><div class="card-header">Заголовок</div><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('card')
    });

    // Alerts
    blockManager.add('alert-primary', {
      label: 'Alert Primary',
      category: 'Alerts',
      content: '<div class="alert alert-primary" role="alert">Сообщение Primary</div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('alert')
    });

    blockManager.add('alert-secondary', {
      label: 'Alert Secondary',
      category: 'Alerts',
      content: '<div class="alert alert-secondary" role="alert">Сообщение Secondary</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-success', {
      label: 'Alert Success',
      category: 'Alerts',
      content: '<div class="alert alert-success" role="alert">Сообщение Success</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-danger', {
      label: 'Alert Danger',
      category: 'Alerts',
      content: '<div class="alert alert-danger" role="alert">Сообщение Danger</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-warning', {
      label: 'Alert Warning',
      category: 'Alerts',
      content: '<div class="alert alert-warning" role="alert">Сообщение Warning</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-info', {
      label: 'Alert Info',
      category: 'Alerts',
      content: '<div class="alert alert-info" role="alert">Сообщение Info</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-light', {
      label: 'Alert Light',
      category: 'Alerts',
      content: '<div class="alert alert-light" role="alert">Сообщение Light</div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('alert-dark', {
      label: 'Alert Dark',
      category: 'Alerts',
      content: '<div class="alert alert-dark" role="alert">Сообщение Dark</div>',
      attributes: { class: 'gjs-block' }
    });

    // Badges
    blockManager.add('badge-primary', {
      label: 'Badge Primary',
      category: 'Badges',
      content: '<span class="badge bg-primary">Badge</span>',
      attributes: { class: 'gjs-block' },
      media: getIcon('badge')
    });

    blockManager.add('badge-secondary', {
      label: 'Badge Secondary',
      category: 'Badges',
      content: '<span class="badge bg-secondary">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-success', {
      label: 'Badge Success',
      category: 'Badges',
      content: '<span class="badge bg-success">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-danger', {
      label: 'Badge Danger',
      category: 'Badges',
      content: '<span class="badge bg-danger">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-warning', {
      label: 'Badge Warning',
      category: 'Badges',
      content: '<span class="badge bg-warning text-dark">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-info', {
      label: 'Badge Info',
      category: 'Badges',
      content: '<span class="badge bg-info">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-light', {
      label: 'Badge Light',
      category: 'Badges',
      content: '<span class="badge bg-light text-dark">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('badge-dark', {
      label: 'Badge Dark',
      category: 'Badges',
      content: '<span class="badge bg-dark">Badge</span>',
      attributes: { class: 'gjs-block' }
    });

    // Forms
    blockManager.add('form-input', {
      label: 'Поле ввода',
      category: 'Forms',
      content: '<div class="mb-3"><label for="input1" class="form-label">Метка</label><input type="text" class="form-control" id="input1" placeholder="Введите текст"></div>',
      attributes: { class: 'gjs-block' },
      media: getIcon('form')
    });

    blockManager.add('form-textarea', {
      label: 'Текстовая область',
      category: 'Forms',
      content: '<div class="mb-3"><label for="textarea1" class="form-label">Метка</label><textarea class="form-control" id="textarea1" rows="3" placeholder="Введите текст"></textarea></div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('form-select', {
      label: 'Выпадающий список',
      category: 'Forms',
      content: '<div class="mb-3"><label for="select1" class="form-label">Метка</label><select class="form-select" id="select1"><option selected>Выберите опцию</option><option value="1">Опция 1</option><option value="2">Опция 2</option></select></div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('form-checkbox', {
      label: 'Чекбокс',
      category: 'Forms',
      content: '<div class="mb-3 form-check"><input type="checkbox" class="form-check-input" id="checkbox1"><label class="form-check-label" for="checkbox1">Метка чекбокса</label></div>',
      attributes: { class: 'gjs-block' }
    });

    blockManager.add('form-radio', {
      label: 'Радио кнопка',
      category: 'Forms',
      content: '<div class="mb-3 form-check"><input type="radio" class="form-check-input" name="radio1" id="radio1" checked><label class="form-check-label" for="radio1">Метка радио</label></div>',
      attributes: { class: 'gjs-block' }
    });

    // Images
    blockManager.add('image', {
      label: 'Изображение',
      category: 'Images',
      content: `<img src="${getPlaceholderImage(300, 200)}" class="img-fluid" alt="Изображение">`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('image-rounded', {
      label: 'Изображение Rounded',
      category: 'Images',
      content: `<img src="${getPlaceholderImage(300, 200)}" class="img-fluid rounded" alt="Изображение">`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('image-circle', {
      label: 'Изображение Circle',
      category: 'Images',
      content: `<img src="${getPlaceholderImage(200, 200)}" class="img-fluid rounded-circle" alt="Изображение">`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('image-thumbnail', {
      label: 'Изображение Thumbnail',
      category: 'Images',
      content: `<img src="${getPlaceholderImage(300, 200)}" class="img-thumbnail" alt="Изображение">`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('figure', {
      label: 'Figure с изображением',
      category: 'Images',
      content: `<figure class="figure"><img src="${getPlaceholderImage(300, 200)}" class="figure-img img-fluid rounded" alt="Изображение"><figcaption class="figure-caption">Подпись к изображению</figcaption></figure>`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('figure-text-start', {
      label: 'Figure слева',
      category: 'Images',
      content: `<figure class="figure"><img src="${getPlaceholderImage(300, 200)}" class="figure-img img-fluid rounded" alt="Изображение"><figcaption class="figure-caption text-start">Подпись к изображению</figcaption></figure>`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('figure-text-end', {
      label: 'Figure справа',
      category: 'Images',
      content: `<figure class="figure"><img src="${getPlaceholderImage(300, 200)}" class="figure-img img-fluid rounded" alt="Изображение"><figcaption class="figure-caption text-end">Подпись к изображению</figcaption></figure>`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('card-image', {
      label: 'Card с изображением',
      category: 'Images',
      content: `<div class="card"><img src="${getPlaceholderImage(300, 200)}" class="card-img-top" alt="Изображение"><div class="card-body"><h5 class="card-title">Заголовок карточки</h5><p class="card-text">Текст карточки</p></div></div>`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    blockManager.add('card-image-overlay', {
      label: 'Card с overlay',
      category: 'Images',
      content: `<div class="card text-white"><img src="${getPlaceholderImage(300, 200)}" class="card-img" alt="Изображение"><div class="card-img-overlay"><h5 class="card-title">Заголовок</h5><p class="card-text">Текст поверх изображения</p></div></div>`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });
  }

  loadContentToEditor(content: string): void {
    if (!this.editor) {
      setTimeout(() => this.loadContentToEditor(content), 100);
      return;
    }

    // Проверяем, что редактор полностью готов (имеет метод setComponents)
    if (!this.editor.setComponents || typeof this.editor.setComponents !== 'function') {
      setTimeout(() => this.loadContentToEditor(content), 100);
      return;
    }

    try {
      // Пытаемся извлечь стили и HTML из контента
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const htmlMatch = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
      
      // Устанавливаем компоненты
      // GrapesJS должен автоматически сохранять существующие ID из HTML
      if (htmlMatch) {
        this.editor.setComponents(htmlMatch);
      } else if (content) {
        // Если нет HTML без стилей, используем весь контент
        this.editor.setComponents(content);
      }
      
      // После загрузки компонентов проверяем и сохраняем ID
      setTimeout(() => {
        try {
          // Получаем все компоненты и убеждаемся, что их ID сохранены
          const components = this.editor.getComponents();
          components.each((component: any) => {
            // Если у компонента нет ID, но он был в исходном HTML, восстанавливаем его
            const el = component.getEl();
            if (el && !component.getId() && el.id) {
              component.set('id', el.id);
            }
          });
        } catch (e) {
          // Не удалось обработать ID компонентов
        }
      }, 300);
      
      // Устанавливаем стили после загрузки компонентов
      if (styleMatch && styleMatch[1]) {
        const cssText = styleMatch[1].trim();
        if (cssText) {
          // Используем setTimeout, чтобы стили применялись после загрузки компонентов
          setTimeout(() => {
            try {
              // Используем правильный API GrapesJS для установки CSS
              if (this.editor.setCss && typeof this.editor.setCss === 'function') {
                this.editor.setCss(cssText);
              } else if (this.editor.Css && this.editor.Css.set && typeof this.editor.Css.set === 'function') {
                this.editor.Css.set(cssText);
              }
              
              // Также добавляем стили в canvas напрямую для отображения
              // Это гарантирует, что стили будут видны в редакторе
              const canvas = this.editor?.Canvas;
              if (canvas) {
                const frameEl = canvas.getFrameEl();
                if (frameEl && frameEl.contentDocument) {
                  const doc = frameEl.contentDocument;
                  let styleEl = doc.getElementById('gjs-editor-styles');
                  if (!styleEl) {
                    styleEl = doc.createElement('style');
                    styleEl.id = 'gjs-editor-styles';
                    doc.head.appendChild(styleEl);
                  }
                  styleEl.textContent = cssText;
                }
              }
            } catch (cssError) {
              // Не удалось установить CSS стили
            }
          }, 200);
        }
      }
    } catch (error) {
      // Fallback: просто устанавливаем HTML
      try {
        this.editor.setComponents(content);
      } catch (fallbackError) {
        // Ошибка при fallback загрузке
      }
    }
  }

  loadArticle(id: string): void {
    this.articleService.getArticle(id).subscribe({
      next: (article) => {
        
        // Устанавливаем значения формы
        const categoryId = article.category?.id || null;
        
        // Устанавливаем выбранные теги
        this.selectedTags = article.tags || [];
        const tagIds = this.selectedTags.map(tag => tag.id);
        
        // Загружаем значения опций
        if (article.option_values && article.option_values.length > 0) {
          this.optionValuesList = article.option_values.map((optionValue: ArticleOptionValue) => ({
            id: optionValue.id,
            option_id: optionValue.option?.id || optionValue.option_id || null,
            value: optionValue.value || ''
          }));
        } else {
          this.optionValuesList = [];
        }
        
        this.articleForm.patchValue({
          title: article.title || '',
          summary: article.summary || '',
          content: article.content || '',
          is_published: article.is_published || false,
          change_description: '',
          category_id: categoryId,
          tag_ids: tagIds
        });
        
        // Загружаем вложения
        this.attachments = article.attachments || [];
        
        // Загружаем вложения
        this.attachments = article.attachments || [];
        
        // Загружаем контент в редактор
        if (article.content) {
          setTimeout(() => {
            this.loadContentToEditor(article.content);
          }, 300);
        }
        
        // Дополнительно устанавливаем значение через setValue для надежности
        // Используем setTimeout, чтобы дать время Angular обновить DOM
        setTimeout(() => {
          const control = this.articleForm.get('category_id');
          if (control) {
            if (categoryId && this.categories.length > 0) {
              // Проверяем, что категория существует в списке
              const categoryExists = this.categories.some(cat => String(cat.id) === String(categoryId));
              
              if (categoryExists) {
                control.setValue(categoryId, { emitEvent: false });
              } else {
                control.setValue(null, { emitEvent: false });
              }
            } else {
              control.setValue(null, { emitEvent: false });
            }
          }
        }, 200);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка загрузки статьи';
      }
    });
  }

  onSubmit(): void {
    // Получаем контент из редактора перед сохранением
    if (this.editor) {
      try {
        const html = this.editor.getHtml ? this.editor.getHtml() : '';
        const css = this.editor.getCss ? this.editor.getCss() : '';
        const content = `<style>${css}</style>${html}`;
        this.articleForm.patchValue({ content });
      } catch (error) {
        // Ошибка получения контента из редактора
      }
    }

    // Собираем значения опций (только заполненные строки)
    const optionValuesData = this.optionValuesList
      .filter(ov => ov.option_id && ov.value && ov.value.trim())
      .map(ov => ({
        option_id: ov.option_id!,
        value: ov.value.trim()
      }));
    this.articleForm.patchValue({ option_values_data: optionValuesData });

    if (this.articleForm.valid) {
      this.saving = true;
      this.error = null;
      
      // Находим новые теги (временные, без id или с id начинающимся с 'temp-')
      const newTags = this.selectedTags.filter(tag => 
        !tag.id || tag.id.startsWith('temp-')
      );
      
      // Если есть новые теги, создаем их перед сохранением статьи
      if (newTags.length > 0) {
        this.createNewTagsAndSave(newTags);
      } else {
        // Нет новых тегов, просто сохраняем статью
        this.saveArticle();
      }
    }
  }

  createNewTagsAndSave(newTags: Tag[]): void {
    // Создаем все новые теги параллельно
    const tagCreationObservables = newTags.map(tag => 
      this.articleService.createTag({ name: tag.name })
    );
    
    // Ждем создания всех тегов
    forkJoin(tagCreationObservables).subscribe({
      next: (createdTags) => {
        // Обновляем selectedTags: заменяем временные теги на созданные
        createdTags.forEach((createdTag, index) => {
          const tempTag = newTags[index];
          const tempTagIndex = this.selectedTags.findIndex(t => 
            (tempTag.id && t.id === tempTag.id) || 
            (!tempTag.id && !t.id && t.name.toLowerCase() === tempTag.name.toLowerCase())
          );
          if (tempTagIndex !== -1) {
            this.selectedTags[tempTagIndex] = createdTag;
          }
          // Добавляем в общий список тегов
          if (!this.tags.find(t => t.id === createdTag.id)) {
            this.tags.push(createdTag);
          }
        });
        
        // Обновляем tag_ids и сохраняем статью
        this.updateTagIds();
        this.saveArticle();
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка создания тегов';
        this.saving = false;
      }
    });
  }

  saveArticle(): void {
    const formValue = this.articleForm.value;
    
    // Преобразуем category_id в формат, который ожидает API
    if (!formValue.category_id || formValue.category_id === '' || formValue.category_id === null) {
      formValue.category_id = null;
    }
    
    // Убеждаемся, что tag_ids - это массив
    if (!Array.isArray(formValue.tag_ids)) {
      formValue.tag_ids = [];
    }
    
    // Определяем категорию из URL для перенаправления
    const url = this.router.url;
    const categoryMatch = url.match(/\/categories\/([^\/]+)\/articles\/new/);
    const categoryId = categoryMatch ? categoryMatch[1] : null;
    
    if (this.isEditMode && this.articleId) {
      this.articleService.updateArticle(this.articleId, formValue).subscribe({
        next: (article) => {
          // Если редактировали из категории, возвращаемся туда, иначе на страницу статьи
          if (categoryId) {
            this.router.navigate(['/categories', categoryId]);
          } else {
            this.router.navigate(['/articles', article.id]);
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка сохранения статьи';
          this.saving = false;
        }
      });
    } else {
      this.articleService.createArticle(formValue).subscribe({
        next: (article) => {
          // Обновляем articleId для возможности загрузки изображений
          this.articleId = article.id;
          this.isEditMode = true;
          
          // Если создали из категории, возвращаемся туда, иначе остаемся на странице редактирования
          if (categoryId) {
            this.router.navigate(['/categories', categoryId]);
          } else {
            // Не перенаправляем, остаемся на странице редактирования для возможности загрузки изображений
            this.saving = false;
            this.error = null;
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка создания статьи';
          this.saving = false;
        }
      });
    }
  }

  cancel(): void {
    // Определяем категорию из URL для перенаправления
    const url = this.router.url;
    const categoryMatch = url.match(/\/categories\/([^\/]+)\/articles\/new/);
    const categoryId = categoryMatch ? categoryMatch[1] : null;
    
    if (categoryId) {
      // Возвращаемся на страницу категории
      this.router.navigate(['/categories', categoryId]);
    } else if (this.articleId) {
      // Возвращаемся на страницу статьи
      this.router.navigate(['/articles', this.articleId]);
    } else {
      // Возвращаемся на список статей
      this.router.navigate(['/articles']);
    }
  }

  importWord(): void {
    this.fileInput.nativeElement.click();
  }

  onWordFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Импортируем файл сразу без модального окна
      this.articleService.importWord(file).subscribe({
        next: (response) => {
          // Добавляем контент в редактор как есть
          if (this.editor) {
            this.addContentToEditor(response.content);
          } else {
            this.error = 'Редактор не инициализирован. Попробуйте позже.';
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Ошибка импорта файла';
        }
      });
      
      // Сбрасываем input для возможности повторного выбора того же файла
      event.target.value = '';
    }
  }

  addContentToEditor(content: string): void {
    if (!this.editor) {
      setTimeout(() => this.addContentToEditor(content), 100);
      return;
    }

    // Проверяем, что редактор полностью готов
    if (!this.editor.addComponents || typeof this.editor.addComponents !== 'function') {
      setTimeout(() => this.addContentToEditor(content), 100);
      return;
    }

    try {
      // Извлекаем HTML (без стилей для компонентов)
      const htmlMatch = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
      
      if (!htmlMatch) {
        this.error = 'Импортированный контент пуст';
        return;
      }

      // Добавляем компоненты к существующему контенту как есть, без оберток
      this.editor.addComponents(htmlMatch);
      
      // Обрабатываем стили (добавляем к существующим)
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch && styleMatch[1]) {
        const cssText = styleMatch[1].trim();
        if (cssText) {
          setTimeout(() => {
            try {
              // Получаем существующие стили
              const existingCss = this.editor.getCss ? this.editor.getCss() : '';
              
              // Объединяем стили (без дополнительных стилей для группы)
              const combinedCss = existingCss + '\n' + cssText;
              
              // Устанавливаем объединенные стили
              if (this.editor.setCss && typeof this.editor.setCss === 'function') {
                this.editor.setCss(combinedCss);
              } else if (this.editor.Css && this.editor.Css.set && typeof this.editor.Css.set === 'function') {
                this.editor.Css.set(combinedCss);
              }
              
              // Также добавляем стили в canvas напрямую для отображения
              const canvas = this.editor?.Canvas;
              if (canvas) {
                const frameEl = canvas.getFrameEl();
                if (frameEl && frameEl.contentDocument) {
                  const doc = frameEl.contentDocument;
                  let styleEl = doc.getElementById('gjs-editor-styles');
                  if (!styleEl) {
                    styleEl = doc.createElement('style');
                    styleEl.id = 'gjs-editor-styles';
                    doc.head.appendChild(styleEl);
                  }
                  
                  // Добавляем стили для body, чтобы предотвратить сужение при импорте
                  const bodyOverrideStyles = `
                    /* Переопределение стилей body для корректного отображения в редакторе */
                    body {
                      width: 100% !important;
                      max-width: 100% !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      box-sizing: border-box !important;
                    }
                    * {
                      box-sizing: border-box;
                    }
                  `;
                  
                  styleEl.textContent = bodyOverrideStyles + '\n' + combinedCss;
                  
                  // Также применяем стили напрямую к body, если он существует
                  const bodyEl = doc.body;
                  if (bodyEl) {
                    bodyEl.style.width = '100%';
                    bodyEl.style.maxWidth = '100%';
                    bodyEl.style.margin = '0';
                    bodyEl.style.padding = '0';
                    bodyEl.style.boxSizing = 'border-box';
                  }
                }
              }
            } catch (cssError) {
              // Не удалось добавить CSS стили
            }
          }, 200);
        }
      }
    } catch (error) {
      this.error = 'Ошибка добавления импортированного контента в редактор';
    }
  }

  onAttachmentFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Проверяем размер файла (50 МБ = 50 * 1024 * 1024 байт)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        this.attachmentUploadError = `Размер файла превышает максимально допустимый размер 50 МБ. Размер файла: ${(file.size / (1024 * 1024)).toFixed(2)} МБ`;
        return;
      }
      
      this.selectedAttachmentFile = file;
      this.attachmentUploadError = null;
    }
  }

  uploadAttachment(): void {
    if (!this.selectedAttachmentFile || !this.articleId) {
      return;
    }

    this.uploadingAttachment = true;
    this.attachmentUploadError = null;

    this.articleService.uploadAttachment(
      this.articleId,
      this.selectedAttachmentFile,
      this.attachmentComment || undefined
    ).subscribe({
      next: (attachment) => {
        // Добавляем загруженный файл в список
        this.attachments = [...this.attachments, attachment];
        // Очищаем форму загрузки
        this.cancelAttachmentUpload();
        this.uploadingAttachment = false;
      },
      error: (err) => {
        this.attachmentUploadError = err.error?.error || 'Ошибка загрузки файла';
        this.uploadingAttachment = false;
      }
    });
  }

  cancelAttachmentUpload(): void {
    this.selectedAttachmentFile = null;
    this.attachmentComment = '';
    this.attachmentUploadError = null;
    // Сбрасываем input файла
    if (this.attachmentInput && this.attachmentInput.nativeElement) {
      this.attachmentInput.nativeElement.value = '';
    }
  }

}

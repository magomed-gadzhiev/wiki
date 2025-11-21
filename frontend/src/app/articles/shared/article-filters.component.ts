import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Tag, ArticleOption } from '../../core/models/article.model';

@Component({
  selector: 'app-article-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filters-section">
      <div class="filters-header" (click)="toggleFilters()">
        <span class="filters-title">Фильтры</span>
        <button type="button" class="btn-toggle-filters" [class.collapsed]="!filtersExpanded">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="filters-content" *ngIf="filtersExpanded">
        <div class="filters-row">
          <div class="filter-group">
            <label><strong>Фильтр по тегам:</strong></label>
            <div class="tags-filter">
              <div class="tags-input-wrapper">
                <input 
                  type="text" 
                  placeholder="Введите название тега..." 
                  [(ngModel)]="tagSearchQuery"
                  (input)="onTagSearch()"
                  (focus)="showTagSuggestions = true"
                  (blur)="hideTagSuggestions()"
                  class="tag-filter-input"
                  [ngModelOptions]="{standalone: true}"
                />
                <div class="tags-suggestions" *ngIf="tagSuggestions.length > 0 && showTagSuggestions" (mousedown)="$event.preventDefault()">
                  <div 
                    *ngFor="let tag of tagSuggestions" 
                    class="tag-suggestion"
                    (click)="selectTagForFilter(tag)"
                  >
                    {{ tag.name }}
                  </div>
                </div>
              </div>
              <div class="selected-filter-tags" *ngIf="selectedTagIds.length > 0">
                <span 
                  *ngFor="let tagId of selectedTagIds" 
                  class="filter-tag-badge"
                >
                  {{ getTagName(tagId) }}
                  <button type="button" class="filter-tag-remove" (click)="removeTagFilter(tagId)">×</button>
                </span>
              </div>
            </div>
          </div>
          
          <div class="filter-group option-filter-group">
            <label>Фильтр по опциям:</label>
            <button class="btn btn-secondary btn-add-option" (click)="openOptionsModal()" title="Выбрать опции">
              +
            </button>
            <div class="selected-option-filters" *ngIf="selectedOptionFilters.length > 0">
              <div 
                *ngFor="let filter of selectedOptionFilters" 
                class="option-filter-item"
              >
                <span class="option-filter-name">{{ getOptionName(filter.option_id) }}:</span>
                <input 
                  type="text" 
                  [(ngModel)]="filter.option_value"
                  (input)="onFilterChange()"
                  placeholder="Значение..."
                  class="option-filter-value"
                  [ngModelOptions]="{standalone: true}"
                />
                <button type="button" class="btn btn-sm btn-danger" (click)="removeOptionFilter(filter)">
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Модальное окно для выбора опций -->
    <div class="modal-overlay" *ngIf="showOptionsModal" (click)="closeOptionsModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Выбор опций для фильтрации</h2>
          <button type="button" class="modal-close" (click)="closeOptionsModal()">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="loadingOptions" class="loading">Загрузка опций...</div>
          <div *ngIf="!loadingOptions && availableOptions.length === 0" class="empty-state">
            Нет доступных опций
          </div>
          <div *ngIf="!loadingOptions && availableOptions.length > 0" class="options-list">
            <div 
              *ngFor="let option of availableOptions" 
              class="option-item"
              [class.selected]="isOptionSelected(option.id)"
              (click)="toggleOption(option)"
            >
              <input 
                type="checkbox" 
                [checked]="isOptionSelected(option.id)"
                (click)="$event.stopPropagation()"
                (change)="toggleOption(option)"
              />
              <div class="option-info">
                <div class="option-name">{{ option.name }}</div>
                <div class="option-description" *ngIf="option.description">{{ option.description }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" (click)="applyOptions()">Применить</button>
          <button type="button" class="btn btn-secondary" (click)="closeOptionsModal()">Отмена</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters-section {
      margin-bottom: 15px;
      margin-top: 15px;
      background-color: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #dee2e6;
      display: block !important;
    }
    .filters-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid #dee2e6;
    }
    .filters-header:hover {
      background-color: #e9ecef;
    }
    .filters-title {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }
    .btn-toggle-filters {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }
    .btn-toggle-filters:hover {
      color: #333;
    }
    .btn-toggle-filters.collapsed {
      transform: rotate(-90deg);
    }
    .filters-content {
      padding: 10px 12px;
    }
    .filters-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 15px;
      align-items: flex-start;
    }
    .filter-group {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 250px;
    }
    .filter-group label {
      font-weight: 600;
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      margin: 0;
    }
    .filter-group .btn {
      padding: 6px 12px;
      font-size: 13px;
      white-space: nowrap;
    }
    .option-filter-group {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-add-option {
      padding: 4px 10px;
      font-size: 18px;
      line-height: 1;
      min-width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .selected-option-filters {
      width: 100%;
      margin-top: 6px;
    }
    .tags-filter {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .tags-input-wrapper {
      position: relative;
    }
    .tag-filter-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
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
    .selected-filter-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .filter-tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background-color: #007bff;
      color: white;
      border-radius: 3px;
      font-size: 12px;
    }
    .filter-tag-remove {
      background: rgba(255, 255, 255, 0.3);
      border: none;
      color: white;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    .filter-tag-remove:hover {
      background: rgba(255, 255, 255, 0.5);
    }
    .selected-option-filters {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .option-filter-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .option-filter-name {
      font-weight: 600;
      min-width: 120px;
      font-size: 12px;
    }
    .option-filter-value {
      flex: 1;
      padding: 5px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #ddd;
    }
    .modal-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .modal-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .modal-close:hover {
      background-color: #f0f0f0;
    }
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .option-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .option-item:hover {
      background-color: #f8f9fa;
    }
    .option-item.selected {
      background-color: #e7f3ff;
      border-color: #007bff;
    }
    .option-info {
      flex: 1;
    }
    .option-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .option-description {
      font-size: 12px;
      color: #666;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px;
      border-top: 1px solid #ddd;
    }
    .loading, .empty-state {
      text-align: center;
      padding: 20px;
      color: #999;
    }
  `]
})
export class ArticleFiltersComponent implements OnInit {
  @Input() selectedTagIds: string[] = [];
  @Input() selectedOptionFilters: { option_id: string; option_value: string }[] = [];
  @Output() tagIdsChange = new EventEmitter<string[]>();
  @Output() optionFiltersChange = new EventEmitter<{ option_id: string; option_value: string }[]>();
  @Output() filterChange = new EventEmitter<void>();

  tagSearchQuery = '';
  tagSuggestions: Tag[] = [];
  showTagSuggestions = false;
  allTags: Tag[] = [];
  private tagSearchTimeout: any;
  
  showOptionsModal = false;
  availableOptions: ArticleOption[] = [];
  loadingOptions = false;
  selectedOptionsInModal: string[] = [];
  
  filtersExpanded = true;

  constructor(private articleService: ArticleService) {}

  ngOnInit(): void {
    this.loadAllTags();
    this.loadOptions();
  }

  loadAllTags(): void {
    this.articleService.getTags().subscribe({
      next: (tags) => {
        this.allTags = tags;
      },
      error: (err) => {
        console.error('Error loading tags', err);
      }
    });
  }

  onTagSearch(): void {
    clearTimeout(this.tagSearchTimeout);
    this.tagSearchTimeout = setTimeout(() => {
      if (this.tagSearchQuery.trim()) {
        this.articleService.getTags(this.tagSearchQuery).subscribe({
          next: (tags) => {
            this.tagSuggestions = tags.filter(tag => tag.id && !this.selectedTagIds.includes(tag.id));
          },
          error: (err) => {
            console.error('Error searching tags', err);
          }
        });
      } else {
        this.tagSuggestions = [];
      }
    }, 300);
  }

  selectTagForFilter(tag: Tag): void {
    if (tag.id && !this.selectedTagIds.includes(tag.id)) {
      const newTagIds = [...this.selectedTagIds, tag.id];
      this.tagIdsChange.emit(newTagIds);
      this.tagSearchQuery = '';
      this.tagSuggestions = [];
      this.showTagSuggestions = false;
      this.filterChange.emit();
    }
  }

  removeTagFilter(tagId: string): void {
    const newTagIds = this.selectedTagIds.filter(id => id !== tagId);
    this.tagIdsChange.emit(newTagIds);
    this.filterChange.emit();
  }

  hideTagSuggestions(): void {
    setTimeout(() => {
      this.showTagSuggestions = false;
    }, 200);
  }

  getTagName(tagId: string): string {
    const tag = this.allTags.find(t => t.id === tagId);
    return tag ? tag.name : tagId;
  }

  loadOptions(): void {
    this.loadingOptions = true;
    this.articleService.getOptions().subscribe({
      next: (options) => {
        this.availableOptions = options;
        this.loadingOptions = false;
      },
      error: (err) => {
        console.error('Error loading options', err);
        this.loadingOptions = false;
      }
    });
  }

  openOptionsModal(): void {
    this.selectedOptionsInModal = this.selectedOptionFilters.map(f => f.option_id);
    this.showOptionsModal = true;
  }

  closeOptionsModal(): void {
    this.showOptionsModal = false;
  }

  isOptionSelected(optionId: string): boolean {
    return this.selectedOptionsInModal.includes(optionId);
  }

  toggleOption(option: ArticleOption): void {
    if (!option.id) return;
    
    if (this.isOptionSelected(option.id)) {
      this.selectedOptionsInModal = this.selectedOptionsInModal.filter(id => id !== option.id);
    } else {
      this.selectedOptionsInModal.push(option.id);
    }
  }

  applyOptions(): void {
    const newFilters = [...this.selectedOptionFilters];
    
    this.selectedOptionsInModal.forEach(optionId => {
      if (!newFilters.find(f => f.option_id === optionId)) {
        newFilters.push({
          option_id: optionId,
          option_value: ''
        });
      }
    });
    
    const filtered = newFilters.filter(f => 
      this.selectedOptionsInModal.includes(f.option_id)
    );
    
    this.optionFiltersChange.emit(filtered);
    this.closeOptionsModal();
    this.filterChange.emit();
  }

  removeOptionFilter(filter: { option_id: string; option_value: string }): void {
    const newFilters = this.selectedOptionFilters.filter(f => f !== filter);
    this.optionFiltersChange.emit(newFilters);
    this.filterChange.emit();
  }

  getOptionName(optionId: string): string {
    const option = this.availableOptions.find(o => o.id === optionId);
    return option ? option.name : optionId;
  }

  onFilterChange(): void {
    this.optionFiltersChange.emit([...this.selectedOptionFilters]);
    this.filterChange.emit();
  }

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }
}


import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Tag, ArticleOption } from '../../core/models/article.model';

@Component({
  selector: 'app-article-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './article-filters.component.html',
  styleUrls: ['./article-filters.component.scss']
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
      error: () => {
        // Ошибка загрузки тегов
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
          error: () => {
            // Ошибка поиска тегов
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
      error: () => {
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


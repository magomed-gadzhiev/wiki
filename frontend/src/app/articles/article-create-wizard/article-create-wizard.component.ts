import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ArticleService } from '../../core/services/article.service';
import { Technology, Element, Tag, ArticleOption, ArticleTemplate } from '../../core/models/article.model';

@Component({
  selector: 'app-article-create-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './article-create-wizard.component.html',
  styleUrls: ['./article-create-wizard.component.scss']
})
export class ArticleCreateWizardComponent implements OnInit {
  currentStep = 1;
  totalSteps = 7;
  
  articleForm: FormGroup;
  
  technologies: Technology[] = [];
  selectedTechnology: Technology | null = null;
  availableElements: Element[] = [];
  
  options: ArticleOption[] = [];
  optionValuesList: Array<{ option_id: string | null; value: string }> = [];
  
  tags: Tag[] = [];
  selectedTags: Tag[] = [];
  tagSuggestions: Tag[] = [];
  showTagSuggestions = false;
  newTagName = '';
  selectedSuggestionIndex = -1;
  
  templates: ArticleTemplate[] = [];
  
  saving = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private articleService: ArticleService
  ) {
    this.articleForm = this.fb.group({
      technology_id: [null, Validators.required],
      element_id: [null, Validators.required],
      model_name: ['', Validators.required],
      summary: [''],
      tag_ids: [[]],
      template_id: [null],
      option_values_data: [[]]
    });
  }

  ngOnInit(): void {
    this.loadTechnologies();
    this.loadOptions();
    this.loadTags();
    this.loadTemplates();
    
    // Подписываемся на изменения технологии для фильтрации элементов
    this.articleForm.get('technology_id')?.valueChanges.subscribe(techId => {
      this.onTechnologyChange(techId);
    });
  }

  loadTechnologies(): void {
    this.articleService.getTechnologies().subscribe({
      next: (technologies) => {
        this.technologies = Array.isArray(technologies) ? technologies : [];
      },
      error: () => {
        this.technologies = [];
      }
    });
  }

  onTechnologyChange(techId: string | null): void {
    if (!techId) {
      this.selectedTechnology = null;
      this.availableElements = [];
      this.articleForm.patchValue({ element_id: null });
      return;
    }
    
    const technology = this.technologies.find(t => t.id === techId);
    if (technology) {
      this.selectedTechnology = technology;
      this.availableElements = technology.elements || [];
    } else {
      this.selectedTechnology = null;
      this.availableElements = [];
    }
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
    const selectedOptionIds = this.optionValuesList
      .map((ov, idx) => idx !== currentIndex ? ov.option_id : null)
      .filter(id => id !== null) as string[];
    
    return this.options.filter(option => 
      !selectedOptionIds.includes(option.id) || option.id === currentOptionId
    );
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

  onTagInputFocus(): void {
    if (this.newTagName.trim().length === 0) {
      this.showAllAvailableTags();
    } else if (this.tagSuggestions.length > 0) {
      this.showTagSuggestions = true;
    }
  }

  onTagInputBlur(): void {
    setTimeout(() => {
      this.showTagSuggestions = false;
      this.selectedSuggestionIndex = -1;
    }, 200);
  }

  showAllAvailableTags(): void {
    const selectedTagIds = this.selectedTags.map(t => t.id).filter(id => id !== undefined) as string[];
    this.tagSuggestions = this.tags.filter(tag => !selectedTagIds.includes(tag.id || ''));
    this.showTagSuggestions = this.tagSuggestions.length > 0;
  }

  searchTags(event: any): void {
    const query = event.target.value.trim();
    this.newTagName = query;
    
    if (query.length === 0) {
      this.showAllAvailableTags();
      return;
    }
    
    const selectedTagIds = this.selectedTags.map(t => t.id).filter(id => id !== undefined) as string[];
    this.tagSuggestions = this.tags.filter(tag => 
      !selectedTagIds.includes(tag.id || '') &&
      tag.name.toLowerCase().includes(query.toLowerCase())
    );
    this.showTagSuggestions = this.tagSuggestions.length > 0;
    this.selectedSuggestionIndex = -1;
  }

  selectTag(tag: Tag): void {
    if (!this.selectedTags.find(t => t.id === tag.id)) {
      this.selectedTags.push(tag);
    }
    this.newTagName = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
  }

  addNewTag(event: Event): void {
    event.preventDefault();
    const tagName = this.newTagName.trim();
    
    if (tagName.length === 0) {
      if (this.tagSuggestions.length > 0 && this.selectedSuggestionIndex >= 0) {
        this.selectTag(this.tagSuggestions[this.selectedSuggestionIndex]);
      }
      return;
    }
    
    // Проверяем, не добавлен ли уже такой тег
    if (this.selectedTags.find(t => t.name.toLowerCase() === tagName.toLowerCase())) {
      this.newTagName = '';
      return;
    }
    
    // Создаем новый тег
    this.articleService.createTag({ name: tagName }).subscribe({
      next: (tag) => {
        this.selectedTags.push(tag);
        this.tags.push(tag);
        this.newTagName = '';
        this.tagSuggestions = [];
        this.showTagSuggestions = false;
      },
      error: (err) => {
        console.error('Ошибка при создании тега:', err);
      }
    });
  }

  removeTag(tag: Tag): void {
    this.selectedTags = this.selectedTags.filter(t => t.id !== tag.id);
  }

  navigateSuggestions(event: Event, direction: number): void {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();
    if (this.tagSuggestions.length === 0) return;
    
    this.selectedSuggestionIndex += direction;
    if (this.selectedSuggestionIndex < 0) {
      this.selectedSuggestionIndex = this.tagSuggestions.length - 1;
    } else if (this.selectedSuggestionIndex >= this.tagSuggestions.length) {
      this.selectedSuggestionIndex = 0;
    }
  }

  hideSuggestions(): void {
    this.showTagSuggestions = false;
    this.selectedSuggestionIndex = -1;
  }

  loadTemplates(): void {
    this.articleService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = Array.isArray(templates) ? templates : [];
      },
      error: () => {
        this.templates = [];
      }
    });
  }

  nextStep(): void {
    // Валидация текущего шага
    if (this.currentStep === 1) {
      if (!this.articleForm.get('technology_id')?.value) {
        this.error = 'Выберите технологию';
        return;
      }
    } else if (this.currentStep === 2) {
      if (!this.articleForm.get('element_id')?.value) {
        this.error = 'Выберите элемент';
        return;
      }
    } else if (this.currentStep === 3) {
      if (!this.articleForm.get('model_name')?.value?.trim()) {
        this.error = 'Укажите название модели';
        return;
      }
    }
    
    this.error = null;
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.error = null;
    }
  }

  onSubmit(): void {
    if (this.articleForm.invalid) {
      this.error = 'Заполните все обязательные поля';
      return;
    }
    
    this.saving = true;
    this.error = null;
    
    const formValue = this.articleForm.value;
    
    // Подготавливаем данные для создания статьи
    const selectedTemplate = this.templates.find(t => t.id === formValue.template_id);
    const content = selectedTemplate ? selectedTemplate.html : '';
    
    const articleData: any = {
      model_name: formValue.model_name,
      summary: formValue.summary || '',
      element_id: formValue.element_id,
      content: content,
      tag_ids: this.selectedTags.map(t => t.id).filter(id => id !== undefined),
      option_values_data: this.optionValuesList
        .filter(ov => ov.option_id && ov.value)
        .map(ov => ({
          option_id: ov.option_id,
          value: ov.value
        }))
    };
    
    this.articleService.createArticle(articleData).subscribe({
      next: (article) => {
        // Перенаправляем на страницу редактирования
        this.router.navigate(['/articles', article.id, 'edit']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.detail || err.error?.message || 'Ошибка при создании статьи';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/articles']);
  }
}


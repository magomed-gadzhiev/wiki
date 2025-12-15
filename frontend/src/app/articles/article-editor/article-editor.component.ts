import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ArticleService } from '../../core/services/article.service';
import { Article, Category, Model, Tag, ArticleOption, ArticleOptionValue, ArticleAttachment } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import * as grapesjs from 'grapesjs';
import { ChartConfigDialogComponent } from '../shared/chart-config-dialog/chart-config-dialog.component';
import { ChartConfig } from '../shared/chart-viewer/chart-viewer.component';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { CkeditorUploadAdapter } from './ckeditor-upload-adapter';

@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ChartConfigDialogComponent, CKEditorModule],
  templateUrl: './article-editor.component.html',
  styleUrls: ['./article-editor.component.scss']
})
export class ArticleEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput: any;
  @ViewChild('attachmentInput') attachmentInput: any;
  @ViewChild('gjsEditor', { static: false }) gjsEditor!: ElementRef;
  @ViewChild('chartConfigDialog') chartConfigDialog!: ChartConfigDialogComponent;
  
  // Тип редактора: 'grapesjs' или 'ckeditor'
  editorType: 'grapesjs' | 'ckeditor' = 'grapesjs';
  public Editor = ClassicEditor;
  ckeditorInstance: any = null;
  
  articleForm: FormGroup;
  isEditMode = false;
  articleId: string | null = null;
  saving = false;
  error: string | null = null;
  categories: Category[] = [];
  models: Model[] = [];
  availableModelsForCreation: Model[] = [];
  modelSelectionError: string | null = null;
  selectedCategoryId: string | null = null;
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
  isPublished = false;
  publishing = false;
  unpublishing = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
    private authService: AuthService
  ) {
    this.articleForm = this.fb.group({
      model_name: ['', Validators.required],
      summary: [''],
      model_id: [null],
      tag_ids: [[]],
      content: [''],
      change_description: [''],
      option_values_data: [[]]
    });

    // Подписываемся на изменения модели для валидации прав
    this.articleForm.get('model_id')?.valueChanges.subscribe(modelId => {
      this.validateModelSelection(modelId);
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
    
    // Загружаем категории и модели сначала, затем статью (если редактирование)
    forkJoin({
      categories: this.articleService.getCategories(),
      models: this.articleService.getModels()
    }).subscribe({
      next: ({ categories, models }) => {
        this.categories = Array.isArray(categories) ? categories : [];
        this.models = Array.isArray(models) ? models : [];
        this.availableModelsForCreation = this.models;
        
        // Если это создание новой статьи и указана категория в URL
        if (!this.isEditMode && categoryId) {
          this.selectedCategoryId = categoryId;
          this.filterModelsByCategory(categoryId);
        }
        
        // После загрузки категорий и моделей загружаем теги, опции и статью, если это режим редактирования
        this.loadTags();
        this.loadOptions();
        if (id) {
          this.loadArticle(id);
        }
      },
      error: () => {
        this.categories = [];
        this.models = [];
        this.availableModelsForCreation = [];
        // Все равно загружаем статью, даже если категории/модели не загрузились
        this.loadTags();
        if (id) {
          this.loadArticle(id);
        }
      }
    });
  }

  filterModelsByCategory(categoryId: string | null): void {
    if (!categoryId) {
      this.availableModelsForCreation = this.models;
      return;
    }
    this.availableModelsForCreation = this.models.filter(m => m.category?.id === categoryId);
  }

  onCategoryChange(categoryId: string | null): void {
    this.selectedCategoryId = categoryId;
    this.filterModelsByCategory(categoryId);
    // Сбрасываем выбранный элемент, если он не принадлежит новой категории
    const currentModelId = this.articleForm.get('model_id')?.value;
    if (currentModelId) {
      const currentModel = this.availableModelsForCreation.find(m => m.id === currentModelId);
      if (!currentModel) {
        this.articleForm.patchValue({ model_id: null });
      }
    }
  }

  validateModelSelection(modelId: string | null): void {
    if (!modelId) {
      this.modelSelectionError = null;
      return;
    }

    // В режиме редактирования не проверяем права (статья уже существует)
    if (this.isEditMode) {
      this.modelSelectionError = null;
      return;
    }

    // Права проверяются на уровне API, здесь просто очищаем ошибку
    this.modelSelectionError = null;
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


  compareElement(el1: string | null, el2: string | null): boolean {
    // Приводим к строкам для сравнения, чтобы избежать проблем с типами
    const str1 = el1 ? String(el1) : null;
    const str2 = el2 ? String(el2) : null;
    
    if (str1 === null && str2 === null) return true;
    if (str1 === null || str2 === null) return false;
    return str1 === str2;
  }

  trackByCategoryId(index: number, category: Category): string {
    return category.id;
  }

  trackByModelId(index: number, model: Model): string {
    return model.id;
  }

  ngAfterViewInit(): void {
    if (this.editorType === 'grapesjs') {
      this.initStudioEditor();
    }
    // CKEditor инициализируется автоматически через компонент
  }

  ngOnDestroy(): void {
    if (this.editor && typeof this.editor.destroy === 'function') {
      this.editor.destroy();
    }
    if (this.ckeditorInstance && typeof this.ckeditorInstance.destroy === 'function') {
      this.ckeditorInstance.destroy();
    }
  }

  // Переключение между редакторами
  switchEditor(type: 'grapesjs' | 'ckeditor'): void {
    if (this.editorType === type) {
      return;
    }

    // Сохраняем контент из текущего редактора
    const currentContent = this.getEditorContent();

    // Уничтожаем текущий редактор
    if (this.editorType === 'grapesjs' && this.editor) {
      if (typeof this.editor.destroy === 'function') {
        this.editor.destroy();
      }
      this.editor = null;
    } else if (this.editorType === 'ckeditor' && this.ckeditorInstance) {
      if (typeof this.ckeditorInstance.destroy === 'function') {
        this.ckeditorInstance.destroy();
      }
      this.ckeditorInstance = null;
    }

    // Переключаем тип редактора
    this.editorType = type;

    // Инициализируем новый редактор
    setTimeout(() => {
      if (type === 'grapesjs') {
        this.initStudioEditor();
        if (currentContent) {
          setTimeout(() => this.loadContentToEditor(currentContent), 500);
        }
      } else {
        // CKEditor инициализируется автоматически, загружаем контент
        if (currentContent) {
          setTimeout(() => this.loadContentToCkeditor(currentContent), 500);
        }
      }
    }, 100);
  }

  // Обработка HTML: оборачивание текста в td/th в span, если нет вложенных тегов
  wrapTextInTableCellSpans(html: string): string {
    if (!html || typeof html !== 'string') {
      return html;
    }

    try {
      // Создаем временный DOM для парсинга HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Находим все td и th элементы
      const cells = doc.querySelectorAll('td, th');
      
      cells.forEach((cell) => {
        // Получаем все дочерние элементы (не текстовые узлы)
        const childElements = Array.from(cell.children);
        
        // Проверяем, есть ли в ячейке теги кроме br
        const hasTagsOtherThanBr = childElements.some(el => {
          const tagName = el.tagName.toLowerCase();
          return tagName !== 'br';
        });
        
        // Проверяем, есть ли уже span в ячейке
        const hasSpan = childElements.some(el => el.tagName.toLowerCase() === 'span');
        
        // Если нет тегов (кроме br) или только br
        if (!hasTagsOtherThanBr) {
          const textContent = cell.textContent?.trim();
          const content = cell.innerHTML.trim();
          
          // Проверяем, не обернут ли уже контент в span
          const trimmedContent = content.replace(/^\s+|\s+$/g, '');
          const isAlreadyWrapped = trimmedContent.startsWith('<span') && trimmedContent.endsWith('</span>');
          
          // Если ячейка пустая (нет текста и нет тегов) или содержит только пробелы/br
          if (!hasSpan && !isAlreadyWrapped) {
            if (!textContent) {
              // Пустая ячейка или только пробелы/br - добавляем span с неразрывным пробелом для редактирования
              cell.innerHTML = '<span>&nbsp;</span>';
            } else {
              // Есть текстовое содержимое - оборачиваем в span
              if (content) {
                cell.innerHTML = `<span>${content}</span>`;
              } else {
                cell.innerHTML = `<span>${textContent}</span>`;
              }
            }
          }
        }
      });
      
      // Возвращаем обработанный HTML
      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error wrapping text in table cells:', error);
      return html;
    }
  }

  // Получение контента из текущего редактора
  getEditorContent(): string {
    if (this.editorType === 'grapesjs' && this.editor) {
      try {
        const html = this.editor.getHtml ? this.editor.getHtml() : '';
        const css = this.editor.getCss ? this.editor.getCss() : '';
        const processedHtml = this.wrapTextInTableCellSpans(html);
        return `<style>${css}</style>${processedHtml}`;
      } catch (error) {
        console.error('Error getting content from GrapesJS:', error);
        return '';
      }
    } else if (this.editorType === 'ckeditor' && this.ckeditorInstance) {
      try {
        return this.ckeditorInstance.getData();
      } catch (error) {
        console.error('Error getting content from CKEditor:', error);
        return '';
      }
    }
    return '';
  }

  // Загрузка контента в CKEditor
  loadContentToCkeditor(content: string): void {
    if (!this.ckeditorInstance) {
      setTimeout(() => this.loadContentToCkeditor(content), 100);
      return;
    }

    try {
      // Извлекаем HTML из контента (убираем стили для CKEditor)
      const htmlMatch = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
      this.ckeditorInstance.setData(htmlMatch || '');
    } catch (error) {
      console.error('Error loading content to CKEditor:', error);
    }
  }

  // Обработчик готовности CKEditor
  onCkeditorReady(editor: any): void {
    this.ckeditorInstance = editor;
    
    // Настраиваем upload adapter для изображений
    if (this.articleId) {
      editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
        return new CkeditorUploadAdapter(loader, this.articleService, this.articleId!);
      };
    }
    
    // Загружаем контент, если он есть
    const content = this.articleForm.get('content')?.value;
    if (content) {
      setTimeout(() => this.loadContentToCkeditor(content), 100);
    }
  }

  // Обработчик изменения контента в CKEditor
  onCkeditorChange(): void {
    if (this.ckeditorInstance) {
      const data = this.ckeditorInstance.getData();
      // Обновляем форму без эмита события, чтобы избежать циклов
      this.articleForm.patchValue({ content: data }, { emitEvent: false });
    }
  }

  // Вставка графика в CKEditor (вызывается из кнопки или другого места)
  insertChartToCkeditor(): void {
    if (!this.ckeditorInstance) {
      return;
    }

    const chartHtml = '<div class="wiki-chart-container" data-chart-config="{}" style="width: 100%; max-width: 100%; height: 500px; max-height: 500px; min-height: 400px; border: 2px dashed #007bff; padding: 20px; text-align: center; background-color: #f8f9fa; margin: 0 auto;"><p style="color: #6c757d; margin: 0;">График (нажмите для настройки)</p></div>';
    
    // Получаем текущий контент
    const currentData = this.ckeditorInstance.getData();
    
    // Добавляем график в конец контента
    const newData = currentData + chartHtml;
    
    // Устанавливаем новый контент
    this.ckeditorInstance.setData(newData);

    // Открываем диалог настройки
    setTimeout(() => {
      this.openChartConfigDialogForCkeditor();
    }, 100);
  }

  // Открытие диалога настройки графика для CKEditor
  openChartConfigDialogForCkeditor(): void {
    if (!this.chartConfigDialog) {
      return;
    }

    // Находим последний вставленный график
    const editorData = this.ckeditorInstance.getData();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorData;
    const chartContainers = tempDiv.querySelectorAll('.wiki-chart-container');
    
    if (chartContainers.length === 0) {
      return;
    }

    const lastChart = chartContainers[chartContainers.length - 1];
    const configAttr = lastChart.getAttribute('data-chart-config');
    let existingConfig: ChartConfig | undefined;
    
    if (configAttr && configAttr !== '{}') {
      try {
        existingConfig = JSON.parse(configAttr);
      } catch (e) {
        console.error('Error parsing chart config:', e);
      }
    }

    // Настраиваем обработчики диалога
    this.chartConfigDialog.onSave = (config: ChartConfig) => {
      this.saveChartConfigForCkeditor(config);
    };

    this.chartConfigDialog.onCancel = () => {
      // Ничего не делаем при отмене
    };

    // Открываем диалог
    this.chartConfigDialog.open(existingConfig);
  }

  // Сохранение конфигурации графика для CKEditor
  saveChartConfigForCkeditor(config: ChartConfig): void {
    if (!this.ckeditorInstance) {
      return;
    }

    try {
      const configJson = JSON.stringify(config);
      const editorData = this.ckeditorInstance.getData();
      
      // Создаем временный контейнер для парсинга HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editorData;
      
      // Находим все графики
      const chartContainers = tempDiv.querySelectorAll('.wiki-chart-container');
      
      if (chartContainers.length === 0) {
        return;
      }

      // Обновляем последний график
      const lastChart = chartContainers[chartContainers.length - 1] as HTMLElement;
      lastChart.setAttribute('data-chart-config', configJson);
      
      // Обновляем внутренний HTML для отображения
      const title = config.title || 'График';
      const seriesCount = config.series ? config.series.length : 0;
      lastChart.innerHTML = `<div style="padding: 20px; text-align: center; background-color: #e7f3ff; border: 2px solid #007bff; border-radius: 4px;">
        <p style="margin: 0; color: #007bff; font-weight: bold;">📊 ${title}</p>
        <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.9em;">${seriesCount} график(ов) настроено</p>
      </div>`;
      
      // Устанавливаем обновленный контент
      this.ckeditorInstance.setData(tempDiv.innerHTML);
    } catch (error) {
      console.error('Error saving chart config:', error);
      this.error = 'Ошибка сохранения конфигурации графика';
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
        // Настройка Selector Manager для применения стилей только к выбранному компоненту
        // Это предотвращает изменение размера всех изображений при изменении одного
        selectorManager: {
          componentFirst: true
        },
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
            
            /* Стили для блока графика в редакторе */
            .wiki-chart-container {
              padding-top: 20px;
              padding-bottom: 20px;
              background-color: rgba(138, 43, 226, 0.05);
              border: 2px dashed rgba(138, 43, 226, 0.3);
              position: relative;
              min-height: 400px;
              width: 100%;
              max-width: 100%;
            }
            
            .wiki-chart-container::before {
              content: 'График по CSV';
              position: absolute;
              top: 5px;
              left: 5px;
              font-size: 11px;
              color: rgba(138, 43, 226, 0.6);
              font-weight: 600;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 1;
            }
            
            .wiki-chart-container:hover {
              background-color: rgba(138, 43, 226, 0.1);
              border-color: rgba(138, 43, 226, 0.5);
            }
            
            /* Стили для таблиц в редакторе */
            table {
              width: 100% !important;
              max-width: 100% !important;
              border-collapse: collapse;
              margin: 20px 0;
              table-layout: auto;
            }
            
            table th,
            table td {
              min-width: 50px !important;
              min-height: 30px !important;
              padding: 8px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: top;
            }
            
            table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            
            /* Стили для span внутри ячеек таблиц - визуальное выделение */
            table td span,
            table th span {
              display: inline-block;
              min-width: 20px;
              min-height: 20px;
              padding: 2px 4px;
              background-color: rgba(0, 123, 255, 0.08);
              border: 1px dashed rgba(0, 123, 255, 0.3);
              border-radius: 2px;
              position: relative;
            }
            
            /* Плейсхолдер для пустых span */
            table td span:empty::before,
            table th span:empty::before {
              content: 'span';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 10px;
              color: rgba(0, 123, 255, 0.5);
              font-weight: 600;
              text-transform: uppercase;
              pointer-events: none;
              white-space: nowrap;
            }
            
            /* Hover эффект для span в ячейках */
            table td span:hover,
            table th span:hover {
              background-color: rgba(0, 123, 255, 0.15);
              border-color: rgba(0, 123, 255, 0.5);
            }
            
            /* Стили для tooltip в ячейках таблиц */
            .table-cell-tooltip {
              position: relative;
              min-height: 20px;
            }
            
            /* Tooltip для ячеек с data-tooltip-text - отображается постоянно для пустых ячеек */
            .table-cell-tooltip[data-tooltip-text]::before {
              content: attr(data-tooltip-text);
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              background-color: #333;
              color: #fff;
              padding: 5px 10px;
              border-radius: 4px;
              font-size: 12px;
              z-index: 1000;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s;
              margin-bottom: 5px;
              font-style: normal;
              max-width: 300px;
              white-space: normal;
              word-wrap: break-word;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            /* Tooltip при hover для пустых ячеек (через класс tooltip-empty) */
            .table-cell-tooltip[data-tooltip-text].tooltip-empty:hover::before {
              opacity: 1;
            }
            
            /* Tooltip при hover для пустых ячеек (fallback для CSS) */
            .table-cell-tooltip[data-tooltip-text]:empty:hover::before {
              opacity: 1;
            }
            
            /* Tooltip при hover для ячеек с контентом (скрыт, так как не пустые) */
            .table-cell-tooltip[data-tooltip-text]:not(.tooltip-empty):hover::before {
              opacity: 0;
            }
            
            .table-cell-tooltip[data-tooltip-text]::after {
              content: '';
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%) translateY(100%);
              border: 5px solid transparent;
              border-top-color: #333;
              z-index: 1000;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s;
            }
            
            /* Стрелка tooltip при hover для пустых ячеек */
            .table-cell-tooltip[data-tooltip-text].tooltip-empty:hover::after,
            .table-cell-tooltip[data-tooltip-text]:empty:hover::after {
              opacity: 1;
            }
            
            /* Стрелка tooltip скрыта для ячеек с контентом */
            .table-cell-tooltip[data-tooltip-text]:not(.tooltip-empty):hover::after {
              opacity: 0;
            }
            
            /* Стили для tooltip-placeholder (если он есть) */
            .table-cell-tooltip .tooltip-placeholder {
              display: inline-block;
              width: 100%;
              min-height: 20px;
              color: #A6A6A6;
              font-style: italic;
            }
            
            .table-cell-tooltip .tooltip-placeholder::before {
              content: attr(data-tooltip-text);
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              background-color: #333;
              color: #fff;
              padding: 5px 10px;
              border-radius: 4px;
              font-size: 12px;
              z-index: 1000;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s;
              margin-bottom: 5px;
              font-style: normal;
              max-width: 300px;
              white-space: normal;
              word-wrap: break-word;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .table-cell-tooltip:hover .tooltip-placeholder::before {
              opacity: 1;
            }
            
            .table-cell-tooltip .tooltip-placeholder::after {
              content: '';
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%) translateY(100%);
              border: 5px solid transparent;
              border-top-color: #333;
              z-index: 1000;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s;
            }
            
            .table-cell-tooltip:hover .tooltip-placeholder::after {
              opacity: 1;
            }
            
            /* Скрываем tooltip-placeholder tooltip, если ячейка содержит видимый текст */
            .table-cell-tooltip:not(:has(.tooltip-placeholder:only-child)) .tooltip-placeholder::before,
            .table-cell-tooltip:not(:has(.tooltip-placeholder:only-child)) .tooltip-placeholder::after {
              display: none;
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
                // Получаем Bootstrap CSS из скомпилированных стилей страницы
                let bootstrapCss = '';
                
                try {
                  // Собираем все CSS правила из всех stylesheets на странице
                  const allRules: string[] = [];
                  Array.from(document.styleSheets).forEach(sheet => {
                    try {
                      if (sheet.cssRules) {
                        Array.from(sheet.cssRules).forEach(rule => {
                          allRules.push(rule.cssText);
                        });
                      }
                    } catch (e) {
                      // Игнорируем ошибки CORS для внешних stylesheets
                    }
                  });
                  
                  // Фильтруем только Bootstrap стили (по характерным классам)
                  const bootstrapKeywords = [
                    '.btn', '.dropdown', '.nav', '.navbar', '.card', 
                    '.container', '.row', '.col', '.form-control', '.modal'
                  ];
                  
                  bootstrapCss = allRules
                    .filter(rule => bootstrapKeywords.some(keyword => rule.includes(keyword)))
                    .join('\n');
                  
                  // Если нашли Bootstrap стили, добавляем их
                  if (bootstrapCss) {
                    const style = canvas.contentDocument.createElement('style');
                    style.textContent = bootstrapCss;
                    canvas.contentDocument.head.appendChild(style);
                    // Добавляем стили layout после добавления Bootstrap CSS
                    addLayoutStyles(canvas.contentDocument);
                  } else {
                    // Fallback: если не удалось получить стили, используем CDN
                    fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css')
                      .then(response => response.text())
                      .then(cssText => {
                        const style = canvas.contentDocument!.createElement('style');
                        style.textContent = cssText;
                        canvas.contentDocument!.head.appendChild(style);
                        addLayoutStyles(canvas.contentDocument!);
                      })
                      .catch(() => {
                        const link = canvas.contentDocument!.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css';
                        canvas.contentDocument!.head.appendChild(link);
                        link.onload = () => {
                          addLayoutStyles(canvas.contentDocument!);
                        };
                        setTimeout(() => {
                          addLayoutStyles(canvas.contentDocument!);
                        }, 500);
                      });
                  }
                } catch (e) {
                  // Ошибка при получении стилей, используем CDN как fallback
                  fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css')
                    .then(response => response.text())
                    .then(cssText => {
                      const style = canvas.contentDocument!.createElement('style');
                      style.textContent = cssText;
                      canvas.contentDocument!.head.appendChild(style);
                      addLayoutStyles(canvas.contentDocument!);
                    })
                    .catch(() => {
                      const link = canvas.contentDocument!.createElement('link');
                      link.rel = 'stylesheet';
                      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css';
                      canvas.contentDocument!.head.appendChild(link);
                      link.onload = () => {
                        addLayoutStyles(canvas.contentDocument!);
                      };
                      setTimeout(() => {
                        addLayoutStyles(canvas.contentDocument!);
                      }, 500);
                    });
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
              const processedHtml = this.wrapTextInTableCellSpans(html);
              const content = `<style>${css}</style>${processedHtml}`;
              this.articleForm.patchValue({ content }, { emitEvent: false });
            } catch (error) {
              // Ошибка синхронизации контента
            }
          }
        };


        // Синхронизируем изменения редактора с формой
        if (this.editor && typeof this.editor.on === 'function') {
          // Обновление компонентов
          this.editor.on('update', () => {
            syncContent();
            setTimeout(() => this.updateTooltipClasses(), 100);
          });
          
          // Обновление стилей через Style Manager
          this.editor.on('style:custom', () => {
            syncContent();
            setTimeout(() => this.updateTooltipClasses(), 100);
          });
          this.editor.on('component:styleUpdate', () => {
            syncContent();
            setTimeout(() => this.updateTooltipClasses(), 100);
          });
          this.editor.on('style:property:update', syncContent);
          
          // Обновление при изменении CSS
          this.editor.on('css:update', syncContent);
          
          // Обновление при изменении компонентов
          this.editor.on('component:update', () => {
            setTimeout(() => this.updateTooltipClasses(), 100);
          });
        }
        
        // Первоначальное обновление классов tooltip
        setTimeout(() => this.updateTooltipClasses(), 500);

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

    // Основные блоки (группа в начале списка)
    blockManager.add('paragraph', {
      label: 'Параграф',
      category: 'Основные',
      content: '<p>Текст параграфа</p>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    blockManager.add('image', {
      label: 'Изображение',
      category: 'Основные',
      content: `<img src="${getPlaceholderImage(300, 200)}" class="img-fluid" alt="Изображение">`,
      attributes: { class: 'gjs-block' },
      media: getIcon('image')
    });

    const chartIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 3 3 21 21 21"/><line x1="7" y1="16" x2="11" y2="16"/><line x1="7" y1="12" x2="15" y2="12"/><line x1="7" y1="8" x2="19" y2="8"/></svg>';
    
    blockManager.add('chart', {
      label: 'График по CSV',
      category: 'Основные',
      content: '<div class="wiki-chart-container" data-chart-config="{}" style="width: 100%; max-width: 100%; height: 500px; max-height: 500px; min-height: 400px; border: 2px dashed #007bff; padding: 20px; text-align: center; background-color: #f8f9fa; margin: 0 auto;"><p style="color: #6c757d; margin: 0;">График (нажмите для настройки)</p></div>',
      attributes: { class: 'gjs-block' },
      media: chartIcon,
      activate: true,
      select: true
    });

    blockManager.add('span', {
      label: 'Span',
      category: 'Основные',
      content: '<span>Текст</span>',
      attributes: { class: 'gjs-block' },
      media: getIcon('paragraph')
    });

    // Layout - Container
    blockManager.add('container', {
      label: 'Container',
      category: 'Layout',
      content: '<div class="container-fluid"><p>Содержимое контейнера</p></div>',
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

    // Настраиваем обработчик для блока графика
    if (this.editor && typeof this.editor.on === 'function') {
      this.editor.on('component:selected', (component: any) => {
        const el = component.getEl();
        if (el && el.classList && el.classList.contains('wiki-chart-container')) {
          this.openChartConfigDialog(component);
        }
      });
    }
  }

  // Обновление классов tooltip в ячейках таблиц
  updateTooltipClasses(): void {
    try {
      const canvas = this.editor?.Canvas;
      if (!canvas) return;
      
      const frameEl = canvas.getFrameEl();
      if (!frameEl || !frameEl.contentDocument) return;
      
      const doc = frameEl.contentDocument;
      const tooltipCells = doc.querySelectorAll('.table-cell-tooltip[data-tooltip-text]');
      
      tooltipCells.forEach((cell: Element) => {
        const htmlCell = cell as HTMLElement;
        // Получаем текстовое содержимое ячейки (без HTML тегов)
        const textContent = htmlCell.textContent?.trim() || '';
        
        // Проверяем, пустая ли ячейка или содержит только пробелы/&nbsp;
        const isEmpty = !textContent || textContent === '\u00A0' || textContent === '&nbsp;';
        
        // Проверяем, содержит ли ячейка только один span с &nbsp;
        const hasOnlyEmptySpan = htmlCell.children.length === 1 && 
          htmlCell.children[0].tagName.toLowerCase() === 'span' &&
          (htmlCell.children[0].textContent?.trim() === '' || 
           htmlCell.children[0].textContent?.trim() === '\u00A0' ||
           htmlCell.children[0].innerHTML === '&nbsp;' ||
           htmlCell.children[0].innerHTML.trim() === '');
        
        if (isEmpty || hasOnlyEmptySpan) {
          htmlCell.classList.add('tooltip-empty');
        } else {
          htmlCell.classList.remove('tooltip-empty');
        }
      });
    } catch (error) {
      // Игнорируем ошибки при обновлении классов
    }
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
        // Обновляем классы tooltip после загрузки контента
        setTimeout(() => this.updateTooltipClasses(), 200);
      } else if (content) {
        // Если нет HTML без стилей, используем весь контент
        this.editor.setComponents(content);
        // Обновляем классы tooltip после загрузки контента
        setTimeout(() => this.updateTooltipClasses(), 300);
      }
      
      // После загрузки компонентов проверяем и сохраняем атрибуты
      setTimeout(() => {
        try {
          // Получаем все компоненты и восстанавливаем их атрибуты
          const components = this.editor.getComponents();
          components.each((component: any) => {
            const el = component.getEl();
            if (el) {
              // Восстанавливаем ID, если он был в исходном HTML
              if (!component.getId() && el.id) {
                component.set('id', el.id);
              }
              
              // Восстанавливаем data-chart-config для графиков
              if (el.classList && el.classList.contains('wiki-chart-container')) {
                const configAttr = el.getAttribute('data-chart-config');
                if (configAttr && configAttr !== '{}') {
                  // Убеждаемся, что атрибут сохранен в компоненте
                  component.addAttributes({ 'data-chart-config': configAttr });
                }
              }
            }
          });
        } catch (e) {
          // Не удалось обработать атрибуты компонентов
          console.error('Error restoring component attributes:', e);
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
        
        // В режиме редактирования добавляем элемент статьи в список доступных элементов,
        // даже если у пользователя нет полных прав (статья уже существует)
        if (article.model && this.isEditMode) {
          const articleModel = article.model;
          // Проверяем, есть ли уже этот элемент в списке
          const existingModel = this.models.find(m => m.id === articleModel.id);
          if (!existingModel) {
            // Добавляем элемент статьи в список элементов
            this.models.push(articleModel);
          }
          // Если у модели есть категория, добавляем её в список категорий
          if (articleModel.category) {
            const existingCategory = this.categories.find(c => c.id === articleModel.category?.id);
            if (!existingCategory) {
              this.categories.push(articleModel.category);
            }
          }
          // Обновляем список доступных моделей для редактирования
          this.availableModelsForCreation = this.models;
        }
        
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
        
        this.isPublished = article.is_published || false;
        
        const modelId = article.model?.id || null;
        const categoryId = article.model?.category?.id || null;
        
        this.articleForm.patchValue({
          model_name: article.model_name || '',
          summary: article.summary || '',
          content: article.content || '',
          change_description: '',
          model_id: modelId,
          tag_ids: tagIds
        });
        
        // Устанавливаем выбранную категорию для фильтрации моделей
        if (categoryId) {
          this.selectedCategoryId = categoryId;
          this.filterModelsByCategory(categoryId);
        }
        
        // Загружаем вложения
        this.attachments = article.attachments || [];
        
        // Загружаем контент в редактор
        if (article.content) {
          setTimeout(() => {
            if (this.editorType === 'grapesjs') {
              this.loadContentToEditor(article.content);
            } else {
              this.loadContentToCkeditor(article.content);
            }
          }, 300);
        }
        
        // Дополнительно устанавливаем значение через setValue для надежности
        // Используем setTimeout, чтобы дать время Angular обновить DOM
        setTimeout(() => {
          const control = this.articleForm.get('model_id');
          if (control) {
            if (modelId && this.models.length > 0) {
              // Проверяем, что элемент существует в списке
              const modelExists = this.models.some(m => String(m.id) === String(modelId));
              
              if (modelExists) {
                control.setValue(modelId, { emitEvent: false });
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
    // Права проверяются на уровне API

    // Получаем контент из текущего редактора перед сохранением
    const content = this.getEditorContent();
    if (content) {
      this.articleForm.patchValue({ content });
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
    
    // Преобразуем model_id в формат, который ожидает API
    if (!formValue.model_id || formValue.model_id === '' || formValue.model_id === null) {
      formValue.model_id = null;
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
          
          // Обновляем upload adapter для CKEditor, если он активен
          if (this.editorType === 'ckeditor' && this.ckeditorInstance && this.articleId) {
            this.ckeditorInstance.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
              return new CkeditorUploadAdapter(loader, this.articleService, this.articleId!);
            };
          }
          
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

  publishArticle(): void {
    if (!this.articleId) {
      return;
    }
    
    if (this.isPublished) {
      this.error = 'Статья уже опубликована';
      return;
    }
    
    if (!confirm('Вы уверены, что хотите опубликовать эту статью?')) {
      return;
    }
    
    this.publishing = true;
    this.error = null;
    
    this.articleService.publishArticle(this.articleId).subscribe({
      next: (article) => {
        this.isPublished = article.is_published;
        this.publishing = false;
        alert('Статья успешно опубликована');
      },
      error: (err) => {
        this.publishing = false;
        this.error = err.error?.error || err.error?.detail || 'Ошибка при публикации статьи';
      }
    });
  }

  unpublishArticle(): void {
    if (!this.articleId) {
      return;
    }
    
    if (!this.isPublished) {
      this.error = 'Статья не опубликована';
      return;
    }
    
    if (!confirm('Вы уверены, что хотите снять эту статью с публикации?')) {
      return;
    }
    
    this.unpublishing = true;
    this.error = null;
    
    this.articleService.unpublishArticle(this.articleId).subscribe({
      next: (article) => {
        this.isPublished = article.is_published;
        this.unpublishing = false;
        alert('Статья успешно снята с публикации');
      },
      error: (err) => {
        this.unpublishing = false;
        this.error = err.error?.error || err.error?.detail || 'Ошибка при снятии статьи с публикации';
      }
    });
  }

  openChartConfigDialog(component: any): void {
    if (!this.chartConfigDialog) {
      return;
    }

    // Получаем текущую конфигурацию из компонента
    const el = component.getEl();
    let existingConfig: ChartConfig | undefined;
    
    if (el && el.getAttribute) {
      const configAttr = el.getAttribute('data-chart-config');
      if (configAttr && configAttr !== '{}') {
        try {
          existingConfig = JSON.parse(configAttr);
        } catch (e) {
          console.error('Error parsing chart config:', e);
        }
      }
    }

    // Настраиваем обработчики диалога
    this.chartConfigDialog.onSave = (config: ChartConfig) => {
      this.saveChartConfig(component, config);
    };

    this.chartConfigDialog.onCancel = () => {
      // Ничего не делаем при отмене
    };

    // Открываем диалог
    this.chartConfigDialog.open(existingConfig);
  }

  saveChartConfig(component: any, config: ChartConfig): void {
    if (!this.editor || !component) {
      return;
    }

    try {
      // Сохраняем конфигурацию в атрибуты компонента GrapesJS
      const configJson = JSON.stringify(config);
      
      // Устанавливаем атрибут через API GrapesJS
      // Используем addAttributes для добавления/обновления атрибута
      const currentAttrs = component.getAttributes() || {};
      currentAttrs['data-chart-config'] = configJson;
      component.setAttributes(currentAttrs);
      
      // Также обновляем внутренний HTML для отображения
      const title = config.title || 'График';
      const seriesCount = config.series ? config.series.length : 0;
      const innerHTML = `<div style="padding: 20px; text-align: center; background-color: #e7f3ff; border: 2px solid #007bff; border-radius: 4px;">
        <p style="margin: 0; color: #007bff; font-weight: bold;">📊 ${title}</p>
        <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.9em;">${seriesCount} график(ов) настроено</p>
      </div>`;
      
      // Обновляем компонент
      component.set('content', innerHTML);
      
      // Убеждаемся, что атрибут сохранен в DOM
      const el = component.getEl();
      if (el) {
        el.setAttribute('data-chart-config', configJson);
      }

      // Принудительно обновляем компонент
      component.trigger('change:attributes');
      component.trigger('change:content');

      // Синхронизируем с формой
      setTimeout(() => {
        const html = this.editor.getHtml ? this.editor.getHtml() : '';
        const css = this.editor.getCss ? this.editor.getCss() : '';
        const content = `<style>${css}</style>${html}`;
        this.articleForm.patchValue({ content }, { emitEvent: false });
      }, 100);
    } catch (error) {
      console.error('Error saving chart config:', error);
      this.error = 'Ошибка сохранения конфигурации графика';
    }
  }

}

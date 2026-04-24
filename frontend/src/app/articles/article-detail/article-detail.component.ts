import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleService } from '../../core/services/article.service';
import { Article } from '../../core/models/article.model';
import { AuthService } from '../../core/services/auth.service';
import { ArticleCommentsComponent } from '../article-comments/article-comments.component';
import { ArticleTocComponent } from '../article-toc/article-toc.component';
import * as Plotly from 'plotly.js-dist-min';
import { ChartConfig } from '../shared/chart-viewer/chart-viewer.component';
import { computeAxisLayout } from '../shared/chart-viewer/chart-axis-helpers';

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleCommentsComponent, ArticleTocComponent],
  templateUrl: './article-detail.component.html',
  styleUrls: ['./article-detail.component.scss']
})
export class ArticleDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('articleContent', { static: false }) articleContent!: ElementRef<HTMLDivElement>;
  
  article: Article | null = null;
  loading = false;
  error: string | null = null;
  sanitizedContent: SafeHtml = '';
  private styleElement: HTMLStyleElement | null = null;
  private chartInstances: HTMLElement[] = [];
  private readonly destroy$ = new Subject<void>();
  contentElement: HTMLElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadArticle(id);
      }
    });
  }

  ngAfterViewInit(): void {
    this.syncContentElementRef();
    if (this.contentElement) {
      this.cdr.detectChanges();
    }

    // Убеждаемся, что стили применены после инициализации представления
    // Это нужно, если статья загрузилась до инициализации представления
    if (this.article && this.article.content && !this.styleElement) {
      setTimeout(() => {
        const styleMatch = this.article!.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch && styleMatch[1]) {
          const cssText = styleMatch[1].trim();
          if (cssText) {
            this.addArticleStyles(cssText);
          }
        }
      }, 100);
    }
    
    // Инициализируем графики после рендеринга
    if (this.articleContent) {
      setTimeout(() => {
        this.initializeCharts();
      }, 200);
    }
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  canEdit(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.article.author.id === user.id || 
           this.article.can_edit.some(u => u.id === user.id) ||
           (user.is_staff ?? false);
  }

  canDelete(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.article.author.id === user.id || 
           this.article.can_delete.some(u => u.id === user.id) ||
           (user.is_staff ?? false);
  }

  canViewVersions(): boolean {
    if (!this.article || !this.isAuthenticated()) return false;
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    
    // Суперпользователи и авторы имеют доступ
    if (this.article.author.id === user.id || (user.is_staff ?? false)) {
      return true;
    }
    
    // Права проверяются на уровне API, здесь просто проверяем индивидуальные права
    // Если есть права на редактирование, значит можно просматривать версии
    return this.article.can_edit.some(u => u.id === user.id);
  }

  private syncContentElementRef(): void {
    if (this.articleContent) {
      this.contentElement = this.articleContent.nativeElement;
    }
  }

  loadArticle(id: string): void {
    this.loading = true;
    this.error = null;
    
    this.articleService.getArticle(id).subscribe({
      next: (article) => {
        this.article = article;
        this.processArticleContent(article.content);
        this.loading = false;

        // ViewChild (#articleContent) внутри *ngIf="article" появляется только после
        // отрисовки; без detectChanges() ссылка остаётся undefined — боковая навигация
        // не монтируется (*ngIf="contentElement").
        this.cdr.detectChanges();
        this.syncContentElementRef();
        if (!this.contentElement) {
          setTimeout(() => {
            this.syncContentElementRef();
            this.cdr.detectChanges();
          }, 0);
        }
        
        // Инициализируем графики после загрузки контента
        setTimeout(() => {
          this.initializeCharts();
        }, 300);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка загрузки статьи';
        this.loading = false;
      }
    });
  }

  processArticleContent(content: string): void {
    // Удаляем старые стили, если они есть
    this.removeArticleStyles();
    
    // Извлекаем стили из контента
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    let cssText = '';
    
    if (styleMatch && styleMatch[1]) {
      cssText = styleMatch[1].trim();
    }
    
    // Убираем теги style из HTML для отображения
    let htmlWithoutStyles = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    
    // Используем DomSanitizer для безопасного встраивания HTML
    // ID к заголовкам уже добавлены на backend
    this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(htmlWithoutStyles);
    
    // Добавляем стили в документ, если они есть
    if (cssText) {
      // Применяем стили с небольшой задержкой, чтобы DOM был готов
      setTimeout(() => {
        this.addArticleStyles(cssText);
        this.initializeCharts();
      }, 50);
    } else {
      // Инициализируем графики даже если нет стилей
      setTimeout(() => {
        this.initializeCharts();
      }, 100);
    }
  }


  addArticleStyles(cssText: string): void {
    // Удаляем старые стили
    this.removeArticleStyles();
    
    // Просто добавляем стили как есть - они должны применяться глобально
    // Если нужна изоляция, можно обернуть в .article-content-wrapper
    // Но для начала попробуем без обертки
    
    // Создаем новый элемент style
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'article-content-styles';
    this.styleElement.textContent = cssText;
    document.head.appendChild(this.styleElement);
    
  }

  removeArticleStyles(): void {
    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    } else {
      // Также проверяем, есть ли стили в head
      const existingStyle = document.getElementById('article-content-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Очищаем стили при уничтожении компонента
    this.removeArticleStyles();
    // Уничтожаем все графики
    this.destroyCharts();
  }

  initializeCharts(): void {
    if (!this.articleContent?.nativeElement) {
      return;
    }

    // Уничтожаем существующие графики
    this.destroyCharts();

    // Находим все контейнеры графиков
    const chartContainers = this.articleContent.nativeElement.querySelectorAll('.wiki-chart-container');
    
    chartContainers.forEach((container) => {
      const htmlContainer = container as HTMLElement;
      const configAttr = htmlContainer.getAttribute('data-chart-config');
      
      if (!configAttr || configAttr === '{}') {
        return;
      }

      try {
        const config: ChartConfig = JSON.parse(configAttr);
        
        if (!config || !config.series || config.series.length === 0) {
          return;
        }

        // Создаем контейнер для графика с элементами управления
        const chartContainer = document.createElement('div');
        chartContainer.style.cssText = 'position: relative; width: 100%; max-width: 100%; height: 500px; max-height: 500px; min-height: 400px; background-color: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); margin: 0 auto;';
        
        // Создаем панель управления
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;';
        
        const leftControlsDiv = document.createElement('div');
        leftControlsDiv.style.cssText = 'display: flex; gap: 12px; align-items: center;';
        
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'btn btn-sm btn-secondary';
        resetButton.textContent = '🔍 Сбросить масштаб';
        resetButton.style.cssText = 'font-size: 0.875rem; padding: 0.25rem 0.75rem;';
        resetButton.title = 'Сбросить масштаб';

        const xLogCheckbox = document.createElement('input');
        xLogCheckbox.type = 'checkbox';
        xLogCheckbox.className = 'form-check-input';
        xLogCheckbox.checked = config.xLog === true;
        
        const yLogCheckbox = document.createElement('input');
        yLogCheckbox.type = 'checkbox';
        yLogCheckbox.className = 'form-check-input';
        yLogCheckbox.checked = config.yLog === true;

        const xLogLabel = document.createElement('label');
        xLogLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #6c757d;';
        xLogLabel.appendChild(xLogCheckbox);
        xLogLabel.appendChild(document.createTextNode('Лог X'));
        
        const yLogLabel = document.createElement('label');
        yLogLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #6c757d;';
        yLogLabel.appendChild(yLogCheckbox);
        yLogLabel.appendChild(document.createTextNode('Лог Y'));
        
        const hintsDiv = document.createElement('div');
        hintsDiv.style.cssText = 'color: #6c757d; font-size: 0.75rem;';
        hintsDiv.textContent = 'Колесо мыши: масштаб | Перетаскивание: перемещение';
        
        leftControlsDiv.appendChild(resetButton);
        leftControlsDiv.appendChild(xLogLabel);
        leftControlsDiv.appendChild(yLogLabel);
        controlsDiv.appendChild(leftControlsDiv);
        controlsDiv.appendChild(hintsDiv);
        
        // Создаем div для Plotly графика
        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'width: 100% !important; max-width: 100%; height: calc(100% - 50px) !important; max-height: calc(100% - 50px) !important;';
        
        // Очищаем контейнер и добавляем элементы
        htmlContainer.innerHTML = '';
        htmlContainer.style.cssText = 'width: 100%; max-width: 100%; padding: 0; background-color: transparent; border: none;';
        chartContainer.appendChild(controlsDiv);
        chartContainer.appendChild(chartDiv);
        htmlContainer.appendChild(chartContainer);

        // Вычисляем диапазоны данных для центрирования
        const allXValues: number[] = [];
        const allYValues: number[] = [];
        
        config.series.forEach(series => {
          series.data.forEach(point => {
            const x = typeof point.x === 'number' ? point.x : parseFloat(String(point.x));
            const y = typeof point.y === 'number' ? point.y : parseFloat(String(point.y));
            if (!isNaN(x) && !isNaN(y)) {
              allXValues.push(x);
              allYValues.push(y);
            }
          });
        });

        // Создаем traces для Plotly
        const traces = config.series.map((series) => {
          const dash = this.getDashStyle(series.lineStyle || 'solid');
          
          // Преобразуем данные в массивы чисел и сортируем по x для правильного отображения линий
          const sortedData = [...series.data]
            .map(point => ({
              x: typeof point.x === 'number' ? point.x : parseFloat(String(point.x)),
              y: typeof point.y === 'number' ? point.y : parseFloat(String(point.y))
            }))
            .filter(point => !isNaN(point.x) && !isNaN(point.y))
            .sort((a, b) => a.x - b.x);
          
          // Используем scattergl для большого количества точек (лучшая производительность)
          const pointCount = sortedData.length;
          const useScatterGL = pointCount > 1000;
          
          // Убеждаемся, что цвет непрозрачный (без альфа-канала)
          const opaqueColor = this.ensureOpaqueColor(series.color);
          
          return {
            x: sortedData.map(point => point.x),
            y: sortedData.map(point => point.y),
            type: useScatterGL ? 'scattergl' : 'scatter',
            mode: 'lines+markers',
            name: series.name,
            opacity: 1,
            line: {
              color: opaqueColor,
              width: Math.max(series.lineWidth || 2, 2), // Минимум 2px
              dash: dash
            },
            marker: {
              color: opaqueColor,
              size: useScatterGL ? 5 : Math.max(8, Math.min(12, pointCount > 100 ? 8 : 10)),
              opacity: 1,
              line: {
                color: '#fff',
                width: 1.5
              }
            },
            hovertemplate: `<b>${series.name}</b><br>` +
              `${config.xAxisLabel || 'X'}: %{x}<br>` +
              `${config.yAxisLabel || 'Y'}: %{y}<extra></extra>`
          };
        });

        const { xRange, yRange, xAxisType, yAxisType } = computeAxisLayout(
          config,
          allXValues,
          allYValues
        );

        const layout: Partial<Plotly.Layout> = {
          title: config.title ? {
            text: config.title,
            font: {
              size: 16,
              family: 'Arial, sans-serif'
            }
          } : undefined,
          xaxis: {
            type: xAxisType,
            title: {
              text: config.xAxisLabel || 'X',
              font: {
                size: 12,
                family: 'Arial, sans-serif'
              }
            },
            range: xRange,
            autorange: xRange === undefined,
            showgrid: true,
            gridcolor: 'rgba(0, 0, 0, 0.1)',
            zeroline: false
          },
          yaxis: {
            type: yAxisType,
            title: {
              text: config.yAxisLabel || 'Y',
              font: {
                size: 12,
                family: 'Arial, sans-serif'
              }
            },
            range: yRange,
            autorange: yRange === undefined,
            showgrid: true,
            gridcolor: 'rgba(0, 0, 0, 0.1)',
            zeroline: false
          },
          legend: {
            x: 0,
            y: 1,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'rgba(0, 0, 0, 0.2)',
            borderwidth: 1
          },
          hovermode: 'closest',
          margin: {
            l: 60,
            r: 20,
            t: config.title ? 60 : 20,
            b: 60
          },
          autosize: true
        };

        const plotlyConfig: Partial<Plotly.Config> = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: 'chart',
            height: 500,
            width: 800,
            scale: 1
          }
        };

        Plotly.newPlot(
          chartDiv,
          traces,
          layout,
          plotlyConfig
        ).then(() => {
          this.chartInstances.push(chartDiv);
          
          // Настраиваем обработчик кнопки сброса zoom
          const resetZoom = () => {
            const {
              xRange: nextXRange,
              yRange: nextYRange,
              xAxisType: nextXAxisType,
              yAxisType: nextYAxisType
            } = computeAxisLayout(config, allXValues, allYValues);

            const relayoutUpdate: any = {
              'xaxis.type': nextXAxisType,
              'xaxis.autorange': nextXRange === undefined,
              'yaxis.type': nextYAxisType,
              'yaxis.autorange': nextYRange === undefined
            };

            if (nextXRange !== undefined) relayoutUpdate['xaxis.range'] = nextXRange;
            if (nextYRange !== undefined) relayoutUpdate['yaxis.range'] = nextYRange;

            Plotly.relayout(chartDiv, relayoutUpdate);
          };

          resetButton.addEventListener('click', resetZoom);

          const validateLogToggle = (nextXLog: boolean | undefined, nextYLog: boolean | undefined): string | null => {
            if (nextXLog === true) {
              if (allXValues.some((v) => v <= 0)) {
                return 'Для логарифмической оси X все значения x должны быть больше 0.';
              }
              if (config.xMin !== undefined && config.xMin <= 0) {
                return 'Для логарифмической оси X минимум X должен быть больше 0.';
              }
              if (config.xMax !== undefined && config.xMax <= 0) {
                return 'Для логарифмической оси X максимум X должен быть больше 0.';
              }
            }

            if (nextYLog === true) {
              if (allYValues.some((v) => v <= 0)) {
                return 'Для логарифмической оси Y все значения y должны быть больше 0.';
              }
              if (config.yMin !== undefined && config.yMin <= 0) {
                return 'Для логарифмической оси Y минимум Y должен быть больше 0.';
              }
              if (config.yMax !== undefined && config.yMax <= 0) {
                return 'Для логарифмической оси Y максимум Y должен быть больше 0.';
              }
            }

            return null;
          };

          xLogCheckbox.addEventListener('change', () => {
            const prevXLog = config.xLog === true;
            const nextXLog = xLogCheckbox.checked ? true : undefined;
            const error = validateLogToggle(nextXLog, config.yLog === true ? true : undefined);

            if (error) {
              alert(error);
              xLogCheckbox.checked = prevXLog;
              return;
            }

            config.xLog = nextXLog;
            htmlContainer.setAttribute('data-chart-config', JSON.stringify(config));
            resetZoom();
          });

          yLogCheckbox.addEventListener('change', () => {
            const prevYLog = config.yLog === true;
            const nextYLog = yLogCheckbox.checked ? true : undefined;
            const error = validateLogToggle(config.xLog === true ? true : undefined, nextYLog);

            if (error) {
              alert(error);
              yLogCheckbox.checked = prevYLog;
              return;
            }

            config.yLog = nextYLog;
            htmlContainer.setAttribute('data-chart-config', JSON.stringify(config));
            resetZoom();
          });
        });
      } catch (error) {
        console.error('Error initializing chart:', error);
        htmlContainer.innerHTML = '<p style="color: #dc3545; padding: 20px; text-align: center;">Ошибка загрузки графика</p>';
      }
    });
  }

  destroyCharts(): void {
    this.chartInstances.forEach(chartDiv => {
      try {
        Plotly.purge(chartDiv);
      } catch (e) {
        // Игнорируем ошибки при уничтожении
      }
    });
    this.chartInstances = [];
  }

  private getDashStyle(style: 'solid' | 'dashed' | 'dotted'): string {
    switch (style) {
      case 'dashed':
        return 'dash';
      case 'dotted':
        return 'dot';
      case 'solid':
      default:
        return 'solid';
    }
  }

  private ensureOpaqueColor(color: string): string {
    // Если цвет в формате rgba с прозрачностью, преобразуем в rgb
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (match) {
        return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
      }
    }
    // Если цвет в hex формате, убеждаемся что он полный (6 символов)
    if (color.startsWith('#')) {
      // Убираем альфа-канал если есть
      if (color.length === 9) {
        return color.substring(0, 7);
      }
      return color;
    }
    return color;
  }

  private getCenteredMin(values: number[]): number {
    if (values.length === 0) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const center = (min + max) / 2;
    const range = max - min;
    // Добавляем 20% отступа с каждой стороны для лучшей видимости
    const padding = range * 0.2;
    return center - (range / 2 + padding);
  }

  private getCenteredMax(values: number[]): number {
    if (values.length === 0) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const center = (min + max) / 2;
    const range = max - min;
    // Добавляем 20% отступа с каждой стороны для лучшей видимости
    const padding = range * 0.2;
    return center + (range / 2 + padding);
  }

  deleteArticle(): void {
    if (!this.article || !confirm('Вы уверены, что хотите удалить эту статью?')) {
      return;
    }
    
    this.articleService.deleteArticle(this.article.id).subscribe({
      next: () => {
        this.router.navigate(['/articles']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка удаления статьи';
      }
    });
  }
}


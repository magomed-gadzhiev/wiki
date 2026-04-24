import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Plotly from 'plotly.js-dist-min';
import { computeAxisLayout } from './chart-axis-helpers';

export interface ChartDataPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface ChartConfig {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: ChartSeries[];
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** Логарифмическая шкала оси X (данные и ручные min/max должны быть > 0) */
  xLog?: boolean;
  /** Логарифмическая шкала оси Y (данные и ручные min/max должны быть > 0) */
  yLog?: boolean;
}

@Component({
  selector: 'app-chart-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-viewer.component.html',
  styleUrls: ['./chart-viewer.component.scss']
})
export class ChartViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() config!: ChartConfig;
  @ViewChild('chartDiv', { static: false }) chartDiv!: ElementRef<HTMLDivElement>;
  
  private plotlyInstance: any = null;
  private allXValues: number[] = [];
  private allYValues: number[] = [];

  ngOnInit(): void {
    // Проверяем наличие конфигурации
    if (!this.config || !this.config.series || this.config.series.length === 0) {
      console.warn('ChartViewerComponent: No chart configuration provided');
      return;
    }
  }

  ngAfterViewInit(): void {
    if (this.chartDiv && this.config) {
      setTimeout(() => {
        this.createChart();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (this.plotlyInstance) {
      Plotly.purge(this.chartDiv.nativeElement);
      this.plotlyInstance = null;
    }
  }

  resetZoom(): void {
    if (this.plotlyInstance && this.chartDiv) {
      const { xRange, yRange, xAxisType, yAxisType } = computeAxisLayout(
        this.config,
        this.allXValues,
        this.allYValues
      );

      Plotly.relayout(this.chartDiv.nativeElement, {
        'xaxis.type': xAxisType,
        'xaxis.range': xRange,
        'xaxis.autorange': xRange === undefined,
        'yaxis.type': yAxisType,
        'yaxis.range': yRange,
        'yaxis.autorange': yRange === undefined
      });
    }
  }

  private createChart(): void {
    if (!this.chartDiv || !this.config) {
      return;
    }

    // Уничтожаем предыдущий график, если он существует
    if (this.plotlyInstance) {
      Plotly.purge(this.chartDiv.nativeElement);
    }

    // Вычисляем диапазоны данных для центрирования
    this.allXValues = [];
    this.allYValues = [];
    this.config.series.forEach(series => {
      series.data.forEach(point => {
        const x = typeof point.x === 'number' ? point.x : parseFloat(String(point.x));
        const y = typeof point.y === 'number' ? point.y : parseFloat(String(point.y));
        if (!isNaN(x) && !isNaN(y)) {
          this.allXValues.push(x);
          this.allYValues.push(y);
        }
      });
    });

    // Создаем traces для каждой серии
    const traces = this.config.series.map((series) => {
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
          `${this.config.xAxisLabel || 'X'}: %{x}<br>` +
          `${this.config.yAxisLabel || 'Y'}: %{y}<extra></extra>`
      };
    });

    const { xRange, yRange, xAxisType, yAxisType } = computeAxisLayout(
      this.config,
      this.allXValues,
      this.allYValues
    );

    const layout: Partial<Plotly.Layout> = {
      title: this.config.title ? {
        text: this.config.title,
        font: {
          size: 16,
          family: 'Arial, sans-serif'
        }
      } : undefined,
      xaxis: {
        type: xAxisType,
        title: {
          text: this.config.xAxisLabel || 'X',
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
          text: this.config.yAxisLabel || 'Y',
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
        t: this.config.title ? 60 : 20,
        b: 60
      },
      autosize: true
    };

    const config: Partial<Plotly.Config> = {
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

    try {
      Plotly.newPlot(
        this.chartDiv.nativeElement,
        traces,
        layout,
        config
      ).then(() => {
        this.plotlyInstance = this.chartDiv.nativeElement;
      });
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }

  onXLogChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const prev = this.config?.xLog === true;
    if (checked === prev) return;

    const nextConfig: ChartConfig = {
      ...this.config,
      xLog: checked ? true : undefined,
      yLog: this.config.yLog
    };

    const validation = this.validateLogConfig(nextConfig);
    if (!validation.ok) {
      (event.target as HTMLInputElement).checked = prev;
      alert(validation.message || 'Некорректные данные для логарифмической шкалы.');
      return;
    }

    this.config.xLog = checked ? true : undefined;
    this.applyAxisLayout();
  }

  onYLogChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const prev = this.config?.yLog === true;
    if (checked === prev) return;

    const nextConfig: ChartConfig = {
      ...this.config,
      yLog: checked ? true : undefined,
      xLog: this.config.xLog
    };

    const validation = this.validateLogConfig(nextConfig);
    if (!validation.ok) {
      (event.target as HTMLInputElement).checked = prev;
      alert(validation.message || 'Некорректные данные для логарифмической шкалы.');
      return;
    }

    this.config.yLog = checked ? true : undefined;
    this.applyAxisLayout();
  }

  private applyAxisLayout(): void {
    if (!this.plotlyInstance || !this.chartDiv) return;

    const { xRange, yRange, xAxisType, yAxisType } = computeAxisLayout(
      this.config,
      this.allXValues,
      this.allYValues
    );

    const relayoutUpdate: any = {
      'xaxis.type': xAxisType,
      'xaxis.autorange': xRange === undefined,
      'yaxis.type': yAxisType,
      'yaxis.autorange': yRange === undefined
    };

    if (xRange !== undefined) relayoutUpdate['xaxis.range'] = xRange;
    if (yRange !== undefined) relayoutUpdate['yaxis.range'] = yRange;

    Plotly.relayout(this.chartDiv.nativeElement, relayoutUpdate);
  }

  private validateLogConfig(nextConfig: ChartConfig): { ok: boolean; message?: string } {
    const xLog = nextConfig.xLog === true;
    const yLog = nextConfig.yLog === true;

    if (xLog) {
      if (this.allXValues.some((v) => v <= 0)) {
        return { ok: false, message: 'Для логарифмической оси X все значения x должны быть больше 0.' };
      }
      if (nextConfig.xMin !== undefined && nextConfig.xMin <= 0) {
        return { ok: false, message: 'Для логарифмической оси X минимум X должен быть больше 0.' };
      }
      if (nextConfig.xMax !== undefined && nextConfig.xMax <= 0) {
        return { ok: false, message: 'Для логарифмической оси X максимум X должен быть больше 0.' };
      }
    }

    if (yLog) {
      if (this.allYValues.some((v) => v <= 0)) {
        return { ok: false, message: 'Для логарифмической оси Y все значения y должны быть больше 0.' };
      }
      if (nextConfig.yMin !== undefined && nextConfig.yMin <= 0) {
        return { ok: false, message: 'Для логарифмической оси Y минимум Y должен быть больше 0.' };
      }
      if (nextConfig.yMax !== undefined && nextConfig.yMax <= 0) {
        return { ok: false, message: 'Для логарифмической оси Y максимум Y должен быть больше 0.' };
      }
    }

    return { ok: true };
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
}

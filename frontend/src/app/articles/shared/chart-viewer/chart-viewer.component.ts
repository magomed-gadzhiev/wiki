import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Plotly from 'plotly.js-dist-min';

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
      // Вычисляем диапазоны данных
      const allXValues: number[] = [];
      const allYValues: number[] = [];
      
      this.config.series.forEach(series => {
        series.data.forEach(point => {
          const x = typeof point.x === 'number' ? point.x : parseFloat(String(point.x));
          const y = typeof point.y === 'number' ? point.y : parseFloat(String(point.y));
          if (!isNaN(x) && !isNaN(y)) {
            allXValues.push(x);
            allYValues.push(y);
          }
        });
      });

      let xRange: number[] | undefined;
      let yRange: number[] | undefined;

      if (this.config.xMin !== undefined && this.config.xMax !== undefined) {
        xRange = [this.config.xMin, this.config.xMax];
      } else if (allXValues.length > 0) {
        const xMin = Math.min(...allXValues);
        const xMax = Math.max(...allXValues);
        const xPadding = (xMax - xMin) * 0.05 || 1;
        xRange = [xMin - xPadding, xMax + xPadding];
      }

      if (this.config.yMin !== undefined && this.config.yMax !== undefined) {
        yRange = [this.config.yMin, this.config.yMax];
      } else if (allYValues.length > 0) {
        const yMin = Math.min(...allYValues);
        const yMax = Math.max(...allYValues);
        const yPadding = (yMax - yMin) * 0.05 || 1;
        yRange = [yMin - yPadding, yMax + yPadding];
      }

      Plotly.relayout(this.chartDiv.nativeElement, {
        'xaxis.range': xRange,
        'xaxis.autorange': xRange === undefined,
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
    const allXValues: number[] = [];
    const allYValues: number[] = [];
    
    this.config.series.forEach(series => {
      series.data.forEach(point => {
        const x = typeof point.x === 'number' ? point.x : parseFloat(String(point.x));
        const y = typeof point.y === 'number' ? point.y : parseFloat(String(point.y));
        if (!isNaN(x) && !isNaN(y)) {
          allXValues.push(x);
          allYValues.push(y);
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

    // Определяем диапазоны осей
    let xRange: number[] | undefined;
    let yRange: number[] | undefined;
    
    if (this.config.xMin !== undefined && this.config.xMax !== undefined) {
      xRange = [this.config.xMin, this.config.xMax];
    } else if (allXValues.length > 0) {
      const xMin = Math.min(...allXValues);
      const xMax = Math.max(...allXValues);
      const xPadding = (xMax - xMin) * 0.05 || 1; // 5% отступа или минимум 1
      xRange = [xMin - xPadding, xMax + xPadding];
    }
    
    if (this.config.yMin !== undefined && this.config.yMax !== undefined) {
      yRange = [this.config.yMin, this.config.yMax];
    } else if (allYValues.length > 0) {
      const yMin = Math.min(...allYValues);
      const yMax = Math.max(...allYValues);
      const yPadding = (yMax - yMin) * 0.05 || 1; // 5% отступа или минимум 1
      yRange = [yMin - yPadding, yMax + yPadding];
    }

    const layout: Partial<Plotly.Layout> = {
      title: this.config.title ? {
        text: this.config.title,
        font: {
          size: 16,
          family: 'Arial, sans-serif'
        }
      } : undefined,
      xaxis: {
        type: 'linear',
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
        type: 'linear',
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

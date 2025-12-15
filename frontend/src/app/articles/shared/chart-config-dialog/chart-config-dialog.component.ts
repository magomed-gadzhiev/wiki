import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ChartConfig, ChartSeries, ChartDataPoint } from '../chart-viewer/chart-viewer.component';
import * as Papa from 'papaparse';

@Component({
  selector: 'app-chart-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './chart-config-dialog.component.html',
  styleUrls: ['./chart-config-dialog.component.scss']
})
export class ChartConfigDialogComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  chartForm: FormGroup;
  seriesFormArray: FormArray;
  showDialog = false;
  chartConfig: ChartConfig | null = null;
  onSave: ((config: ChartConfig) => void) | null = null;
  onCancel: (() => void) | null = null;

  // Предустановленные цвета для графиков
  readonly defaultColors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
    '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d'
  ];

  constructor(private fb: FormBuilder) {
    this.seriesFormArray = this.fb.array([]);
    this.chartForm = this.fb.group({
      title: [''],
      xAxisLabel: ['X'],
      yAxisLabel: ['Y'],
      xMin: [''],
      xMax: [''],
      yMin: [''],
      yMax: [''],
      series: this.seriesFormArray
    });
  }

  ngOnInit(): void {
    // Добавляем первую серию по умолчанию
    this.addSeries();
  }

  open(existingConfig?: ChartConfig): void {
    this.showDialog = true;
    
    if (existingConfig) {
      // Загружаем существующую конфигурацию
      this.chartForm.patchValue({
        title: existingConfig.title || '',
        xAxisLabel: existingConfig.xAxisLabel || 'X',
        yAxisLabel: existingConfig.yAxisLabel || 'Y',
        xMin: existingConfig.xMin?.toString() || '',
        xMax: existingConfig.xMax?.toString() || '',
        yMin: existingConfig.yMin?.toString() || '',
        yMax: existingConfig.yMax?.toString() || ''
      });

      // Очищаем массив серий
      while (this.seriesFormArray.length !== 0) {
        this.seriesFormArray.removeAt(0);
      }

      // Добавляем существующие серии
      existingConfig.series.forEach(series => {
        const seriesGroup = this.createSeriesGroup();
        seriesGroup.patchValue({
          name: series.name,
          color: series.color,
          lineWidth: series.lineWidth || 2,
          lineStyle: series.lineStyle || 'solid',
          csvData: JSON.stringify(series.data, null, 2)
        });
        this.seriesFormArray.push(seriesGroup);
      });
    } else {
      // Создаем новую конфигурацию
      this.chartForm.reset({
        title: '',
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        xMin: '',
        xMax: '',
        yMin: '',
        yMax: ''
      });
      
      while (this.seriesFormArray.length !== 0) {
        this.seriesFormArray.removeAt(0);
      }
      this.addSeries();
    }
  }

  close(): void {
    this.showDialog = false;
  }

  get seriesControls() {
    return this.seriesFormArray.controls as FormGroup[];
  }

  addSeries(): void {
    const seriesGroup = this.createSeriesGroup();
    this.seriesFormArray.push(seriesGroup);
  }

  removeSeries(index: number): void {
    if (this.seriesFormArray.length > 1) {
      this.seriesFormArray.removeAt(index);
    }
  }

  private createSeriesGroup(): FormGroup {
    const colorIndex = this.seriesFormArray.length % this.defaultColors.length;
    return this.fb.group({
      name: ['', Validators.required],
      color: [this.defaultColors[colorIndex], Validators.required],
      lineWidth: [2, [Validators.required, Validators.min(1), Validators.max(10)]],
      lineStyle: ['solid', Validators.required],
      csvData: ['', Validators.required]
    });
  }

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    // Проверяем расширение файла
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Пожалуйста, выберите CSV файл');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseCSV(text, index);
    };
    reader.readAsText(file, 'UTF-8');
  }

  private parseCSV(csvText: string, index: number): void {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const data: ChartDataPoint[] = [];
        const errors: string[] = [];

        results.data.forEach((row: any, rowIndex: number) => {
          if (Array.isArray(row) && row.length >= 2) {
            const x = parseFloat(row[0]);
            const y = parseFloat(row[1]);

            if (isNaN(x) || isNaN(y)) {
              errors.push(`Строка ${rowIndex + 1}: неверный формат данных (ожидаются числа)`);
              return;
            }

            data.push({ x, y });
          } else if (row.length > 0) {
            errors.push(`Строка ${rowIndex + 1}: неверный формат (ожидаются 2 колонки)`);
          }
        });

        if (errors.length > 0) {
          alert(`Ошибки при парсинге CSV:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
        }

        if (data.length === 0) {
          alert('Не удалось загрузить данные из CSV файла. Убедитесь, что файл содержит две колонки с числовыми значениями.');
          return;
        }

        // Обновляем данные в форме
        const seriesGroup = this.seriesFormArray.at(index) as FormGroup;
        seriesGroup.patchValue({
          csvData: JSON.stringify(data, null, 2)
        });

        // Если имя серии не заполнено, предлагаем имя файла
        if (!seriesGroup.get('name')?.value) {
          const fileName = (this.fileInput.nativeElement as any).files?.[0]?.name || `График ${index + 1}`;
          seriesGroup.patchValue({
            name: fileName.replace('.csv', '')
          });
        }
      },
      error: (error: Error) => {
        alert(`Ошибка при чтении CSV файла: ${error.message}`);
      }
    });
  }

  save(): void {
    if (this.chartForm.invalid) {
      // Помечаем все поля как touched для отображения ошибок
      this.markFormGroupTouched(this.chartForm);
      return;
    }

    const formValue = this.chartForm.value;
    const series: ChartSeries[] = [];

    formValue.series.forEach((seriesData: any, index: number) => {
      try {
        const data: ChartDataPoint[] = JSON.parse(seriesData.csvData);
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Данные должны быть массивом точек');
        }

        // Проверяем формат данных
        data.forEach((point, pointIndex) => {
          if (typeof point.x !== 'number' || typeof point.y !== 'number') {
            throw new Error(`Точка ${pointIndex + 1}: x и y должны быть числами`);
          }
        });

        series.push({
          name: seriesData.name,
          data: data,
          color: seriesData.color,
          lineWidth: seriesData.lineWidth || 2,
          lineStyle: seriesData.lineStyle || 'solid'
        });
      } catch (error: any) {
        alert(`Ошибка в серии "${seriesData.name}": ${error.message}`);
        throw error;
      }
    });

    const config: ChartConfig = {
      title: formValue.title || undefined,
      xAxisLabel: formValue.xAxisLabel || 'X',
      yAxisLabel: formValue.yAxisLabel || 'Y',
      xMin: formValue.xMin ? parseFloat(formValue.xMin) : undefined,
      xMax: formValue.xMax ? parseFloat(formValue.xMax) : undefined,
      yMin: formValue.yMin ? parseFloat(formValue.yMin) : undefined,
      yMax: formValue.yMax ? parseFloat(formValue.yMax) : undefined,
      series: series
    };

    this.chartConfig = config;
    
    if (this.onSave) {
      this.onSave(config);
    }
    
    this.close();
  }

  cancel(): void {
    if (this.onCancel) {
      this.onCancel();
    }
    this.close();
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getSeriesErrorMessage(index: number, field: string): string {
    const seriesGroup = this.seriesFormArray.at(index) as FormGroup;
    const control = seriesGroup.get(field);
    
    if (control?.hasError('required') && control.touched) {
      return 'Это поле обязательно';
    }
    
    if (control?.hasError('min') && control.touched) {
      return `Минимальное значение: ${control.errors?.['min'].min}`;
    }
    
    if (control?.hasError('max') && control.touched) {
      return `Максимальное значение: ${control.errors?.['max'].max}`;
    }
    
    return '';
  }
}


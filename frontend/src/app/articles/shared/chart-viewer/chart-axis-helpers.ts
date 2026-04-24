/** Поля конфига, нужные для расчёта осей (без циклического импорта ChartConfig). */
export type ChartAxisConfigSlice = {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLog?: boolean;
  yLog?: boolean;
};

export interface AxisLayoutResult {
  xRange: number[] | undefined;
  yRange: number[] | undefined;
  xAxisType: 'linear' | 'log';
  yAxisType: 'linear' | 'log';
}

function logAxisRangeFromValues(values: number[]): number[] | undefined {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) {
    return undefined;
  }
  const min = Math.min(...positive);
  const max = Math.max(...positive);
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const span = logMax - logMin || 0.05;
  const pad = span * 0.05;
  return [Math.pow(10, logMin - pad), Math.pow(10, logMax + pad)];
}

function linearAxisRangeFromValues(values: number[]): number[] | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.05 || 1;
  return [min - padding, max + padding];
}

/**
 * Диапазоны и типы осей для Plotly (линейная / логарифмическая).
 */
export function computeAxisLayout(
  config: ChartAxisConfigSlice,
  allXValues: number[],
  allYValues: number[]
): AxisLayoutResult {
  const xLog = config.xLog === true;
  const yLog = config.yLog === true;

  let xRange: number[] | undefined;
  let yRange: number[] | undefined;

  if (config.xMin !== undefined && config.xMax !== undefined) {
    xRange = [config.xMin, config.xMax];
  } else if (xLog) {
    xRange = logAxisRangeFromValues(allXValues);
  } else {
    xRange = linearAxisRangeFromValues(allXValues);
  }

  if (config.yMin !== undefined && config.yMax !== undefined) {
    yRange = [config.yMin, config.yMax];
  } else if (yLog) {
    yRange = logAxisRangeFromValues(allYValues);
  } else {
    yRange = linearAxisRangeFromValues(allYValues);
  }

  return {
    xRange,
    yRange,
    xAxisType: xLog ? 'log' : 'linear',
    yAxisType: yLog ? 'log' : 'linear'
  };
}

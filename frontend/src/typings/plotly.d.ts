declare module 'plotly.js-dist-min' {
  export interface Data {
    x?: number[] | string[];
    y?: number[] | string[];
    type?: string;
    mode?: string;
    name?: string;
    line?: {
      color?: string;
      width?: number;
      dash?: string;
    };
    marker?: {
      color?: string;
      size?: number;
      line?: {
        color?: string;
        width?: number;
      };
    };
    hovertemplate?: string;
    [key: string]: any;
  }

  export interface Layout {
    title?: {
      text?: string;
      font?: {
        size?: number;
        family?: string;
      };
    };
    xaxis?: {
      title?: {
        text?: string;
        font?: {
          size?: number;
          family?: string;
        };
      };
      range?: number[];
      showgrid?: boolean;
      gridcolor?: string;
      zeroline?: boolean;
      [key: string]: any;
    };
    yaxis?: {
      title?: {
        text?: string;
        font?: {
          size?: number;
          family?: string;
        };
      };
      range?: number[];
      showgrid?: boolean;
      gridcolor?: string;
      zeroline?: boolean;
      [key: string]: any;
    };
    legend?: {
      x?: number;
      y?: number;
      bgcolor?: string;
      bordercolor?: string;
      borderwidth?: number;
      [key: string]: any;
    };
    hovermode?: string;
    margin?: {
      l?: number;
      r?: number;
      t?: number;
      b?: number;
    };
    autosize?: boolean;
    [key: string]: any;
  }

  export interface Config {
    responsive?: boolean;
    displayModeBar?: boolean;
    displaylogo?: boolean;
    modeBarButtonsToRemove?: string[];
    toImageButtonOptions?: {
      format?: string;
      filename?: string;
      height?: number;
      width?: number;
      scale?: number;
    };
    [key: string]: any;
  }

  export interface PlotlyHTMLElement extends HTMLElement {
    data: Data[];
    layout: Layout;
    config: Config;
  }

  export function newPlot(
    root: HTMLElement | string,
    data: Data[],
    layout?: Partial<Layout>,
    config?: Partial<Config>
  ): Promise<PlotlyHTMLElement>;

  export function relayout(
    root: HTMLElement | string,
    update: Partial<Layout>
  ): Promise<PlotlyHTMLElement>;

  export function purge(root: HTMLElement | string): void;

  const Plotly: {
    newPlot: typeof newPlot;
    relayout: typeof relayout;
    purge: typeof purge;
  };

  export default Plotly;
}

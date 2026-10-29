/**
 * Tree-shaken ECharts core for the app's charts.
 *
 * Registers only the chart types, components and features the time chart and
 * cumulative charts use (line charts, grid, tooltip, legend, toolbox, data zoom,
 * aria, canvas renderer). This keeps the bundle much smaller than importing the
 * full `echarts` package, which pulls in every chart type and renderer.
 *
 * Use `ReactECharts` from here with `echarts={echarts}`, and type options with `ECOption`.
 */
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import ReactECharts from 'echarts-for-react/esm/core';
import type { LineSeriesOption } from 'echarts/charts';
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  ToolboxComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts/core';

echarts.use([
  LineChart,
  GridComponent,
  // `grid.containLabel` needs this since ECharts 6
  LegacyGridContainLabel,
  TooltipComponent,
  LegendComponent,
  // Toolbox registers its own features: dataZoom select, saveAsImage, dataView
  ToolboxComponent,
  // Inside (mouse wheel/drag) and slider data zoom
  DataZoomComponent,
  // Text description of the chart for screen readers (also read by the e2e tests)
  AriaComponent,
  CanvasRenderer,
]);

/** Option type composed from only the registered charts and components. */
export type ECOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | ToolboxComponentOption
  | DataZoomComponentOption
  | AriaComponentOption
>;

/** Chart instance type returned by `onChartReady`. */
export type EChartsInstance = echarts.EChartsType;

export { echarts, ReactECharts };

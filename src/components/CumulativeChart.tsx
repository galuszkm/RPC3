import ReactECharts, { EChartsInstance } from "echarts-for-react";

import { useEffect, useState } from "react";
import { fixedOptions, tooltipFormatter } from "./CumulativeChartOptions";
import "./CumulativeChart.css";

const CHART_OPTS = { width: 'auto', height: 'auto' } as const;

const generateData = (x: Float64Array | number[], y: Float64Array | number[]) => {
  const len = x.length;
  const data = new Float64Array(len * 2);
  for (let i = 0; i < len; i++) {
    data[i * 2] = x[i];  // X values
    data[i * 2 + 1] = y[i]; // Y values
  }
  return data;
};

interface CumulativeChartProps {
  x: Float64Array[];
  y: Float64Array[];
  name: string[];
  xLabel?: string;  // Optional with a default value
  yLabel?: string;  // Optional with a default value
  xTypeLog?: boolean;  // Optional with a default value
  eqSignals?: [number[], number[]][] // Optional eq block signals
  eqSignalsName?: string[] // Optional eq block signals names
}

export default function CumulativeChart({
  x, y, name, 
  xLabel = "Cumulative [-]", yLabel = "Range", xTypeLog = false,
  eqSignals = [], eqSignalsName = [],
}: CumulativeChartProps) {
  // ECharts instance, set once echarts-for-react has finished its async init
  const [chart, setChart] = useState<EChartsInstance | null>(null);

  // Bind double click event handler to chart ref
  useEffect(() => {
    if (!chart) return;
    const chartInstance = chart;
    const handleDoubleClick = () => {
      // Reset dataZoom to full range (0% ~ 100%)
      chartInstance.dispatchAction({
        type: "dataZoom",
        start: 0,
        end: 100
      });
    };
    // Bind double click handler to event
    // Listen for 'dblclick' on the chart
    chartInstance.getZr()?.on("dblclick", handleDoubleClick);
    // Cleanup listener on unmount
    return () => {
      if (!chartInstance.isDisposed()) {
        chartInstance.getZr()?.off("dblclick", handleDoubleClick);
      }
    };
  }, [chart]);

  // **Effect to Update Series & Y-Axis Name Dynamically**
  useEffect(() => {
    if (chart && !chart.isDisposed()) {
      const chartInstance = chart;

      // Generate Series Data Dynamically
      const seriesData = []
      for (let i=0; i<x.length; i++) {
        seriesData.push({
          type: "line",
          step: 'start',
          name: name[i],
          dimensions: ["x", "y"],
          data: generateData(x[i], y[i]),
          showSymbol: false,
          large: true,
          sampling: "lttb",
          silent: true,
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 3 },
        });
      }
      for (let i=0; i<eqSignals.length; i++) {
        seriesData.push({
          type: "line",
          step: 'start',
          name: `Eq. signal ${eqSignalsName[i]}`,
          dimensions: ["x", "y"],
          data: generateData(...eqSignals[i]),
          showSymbol: false,
          large: true,
          sampling: "lttb",
          silent: true,
          // areaStyle: { opacity: 0.15 },
          lineStyle: { width: 3 },
          color: 'rgba(255,0,0,0.6)',
        });
      }

      // Update Chart
      chartInstance.setOption(
        {
          series: seriesData,
          xAxis: {
            ...fixedOptions.xAxis,
            name: xLabel,
            type: xTypeLog ? 'log' : 'value',
            min: xTypeLog ? 1 : 'dataMin',
          },
          yAxis: {
            ...fixedOptions.yAxis,
            name: yLabel,
          },
          tooltip: {
            ...fixedOptions.tooltip,
            formatter: (params: Object) => tooltipFormatter(params, xLabel),
          }
        },
        {
          notMerge: false,
          replaceMerge: ["series"]  // <--- Key to removing old series!
        }
      );
    }
  }, [chart, x, y, xTypeLog, xLabel, yLabel, name]);

  return (
    <ReactECharts
      option={fixedOptions}
      onChartReady={setChart}
      // Size from the DOM on every resize (echarts-for-react 3.0.6 otherwise fixes the initial px size)
      opts={CHART_OPTS}
      className="cumulative-chart-container"
    />
  )
}

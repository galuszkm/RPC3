import ReactECharts from "echarts-for-react";
import { useEffect, useRef } from "react";
import { fixedOptions } from "./CumulativeChartOptions";
import "./CumulativeChart.css";

const generateData = (x: Float64Array, y: Float64Array) => {
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
}

export default function CumulativeChart({
  x, y, name, xLabel = "Cumulative [-]", yLabel = "Range", xTypeLog = false,
}: CumulativeChartProps) {
  const chartRef = useRef<ReactECharts | null>(null);

  // Bind double click event handler to chart ref
  useEffect(() => {
    let chartInstance: any;
    const handleDoubleClick = () => {
      // Reset dataZoom to full range (0% ~ 100%)
      chartInstance.dispatchAction({
        type: "dataZoom",
        start: 0,
        end: 100
      });
    };
    // Bind double click handler to event
    if (chartRef.current) {
      chartInstance = chartRef.current.getEchartsInstance();
      // Listen for 'dblclick' on the chart
      if (chartInstance.getZr()) {
        chartInstance.getZr().on("dblclick", handleDoubleClick);
      }
    }
    // Cleanup listener on unmount
    return () => {
      if (chartInstance && chartInstance.getZr()) {
        chartInstance.getZr().off("dblclick", handleDoubleClick);
      }
    };
  }, []);

  // **Effect to Update Series & Y-Axis Name Dynamically**
  useEffect(() => {
    if (chartRef.current) {
      // Get chart instance
      const chartInstance = chartRef.current.getEchartsInstance();

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
          }
        },
        {
          notMerge: false,
          replaceMerge: ["series"]  // <--- Key to removing old series!
        }
      );
    }
  }, [x, y, xTypeLog, xLabel, yLabel, name]);

  return (
    <ReactECharts
      ref={chartRef}
      option={fixedOptions}
      className="cumulative-chart-container"
    />
  )
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannels } from "../context/ChannelsContext";
import { echarts, ReactECharts, type EChartsInstance } from "./charts/echartsCore";

import { fixedOptions } from "./TimeChartOptions";
import type { Channel } from "../rpc3";
import TooltipIcon from "../icons/TooltipIcon";
import { Tooltip } from "primereact/tooltip";
import "./TimeChart.css";

const CHART_OPTS = { width: 'auto', height: 'auto' } as const;
const CHART_STYLE = { height: '100%' };

const generateData = (c: Channel) => {
  const len = c.value.length;
  const data = new Float64Array(len * 2);
  for (let i = 0; i < len; i++) {
    data[i * 2] = i * c.dt;  // X values (time)
    data[i * 2 + 1] = c.value[i]; // Y values (signal)
  }
  return data;
};

interface TimeChartProps {
  resizeTrigger: number;
}

export default function TimeChart({ resizeTrigger }: TimeChartProps) {
  // Local states and refs
  // ECharts instance, set once echarts-for-react has finished its async init
  const [chart, setChart] = useState<EChartsInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pointerActive, setPointerActive] = useState(false);

  // Get channels from context
  const { channels } = useChannels();

  // Fit the chart height to its wrapper
  const resizeChart = useCallback(() => {
    if (chart && !chart.isDisposed() && wrapperRef.current) {
      const wrapperHeight = wrapperRef.current.getBoundingClientRect().height;
      chart.resize({height: wrapperHeight});
    }
  }, [chart]);

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
    window.addEventListener('resize', resizeChart)
    // Listen for 'dblclick' on the chart
    chartInstance.getZr()?.on("dblclick", handleDoubleClick);
    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('resize', resizeChart)
      if (!chartInstance.isDisposed()) {
        chartInstance.getZr()?.off("dblclick", handleDoubleClick);
      }
    };
  }, [chart, resizeChart]);

  // **Effect to Update Series & Y-Axis Name Dynamically**
  useEffect(() => {
    if (chart && !chart.isDisposed()) {
      const chartInstance = chart;

      // Generate Series Data Dynamically
      const seriesData = channels.map(c => ({
        type: "line",
        name: `${c.Name} - ${c.filename?.split('.')[0]} [${c.Units}]`,
        dimensions: ["x", "y"],
        data: generateData(c),
        showSymbol: false,
        large: true,
        sampling: "lttb",
        silent: true,
        lineStyle: { width: 1 },
      }));

      // Update Chart
      chartInstance.setOption(
        {
          series: seriesData, 
          yAxis: { 
            ...fixedOptions.yAxis, 
            name: [...new Set(channels.map(c => c.Units))].map(i=>`[${i}]`).join(", "),
          },
          // Tooltip visibility is managed by the pointer effect below and kept by merge
        },
        {
          notMerge: false,
          replaceMerge: ["series"]  // <--- Key to removing old series!
        }
      );
    }
  }, [chart, channels]); // Re-run when chart is ready or channels change

  // Active tooltip
  useEffect(() => {
    if (chart && !chart.isDisposed()) {
      // Update Chart
      chart.setOption(
        {
          tooltip: {
            ...fixedOptions.tooltip,
            show: pointerActive,
          }
        }
      )
    }
  }, [chart, pointerActive])

  // **Resize Chart When Splitter Resizing Ends**
  // biome-ignore lint/correctness/useExhaustiveDependencies: resizeTrigger changes when the splitter is moved, which is the signal to resize
  useEffect(() => {
    resizeChart()
  }, [resizeTrigger, resizeChart]);

  return (
    <div className="time-chart-wrapper" ref={wrapperRef}>
      <Tooltip 
        target=".extra-toolbox-button-icon"
        className="extra-toolbox-button-tooltip"
        content="Toggle Pointer" 
        position="bottom" 
      />
      <TooltipIcon 
        width="17" 
        height="17" 
        className={`extra-toolbox-button-icon${pointerActive ? ' active': ""}`}
        onClick={() => setPointerActive(prev => !prev)}
      />
      <ReactECharts
        echarts={echarts}
        option={fixedOptions}
        onChartReady={setChart}
        // Size from the DOM on every resize (echarts-for-react 3.0.6 otherwise fixes the initial px size)
        opts={CHART_OPTS}
        // Fill the wrapper instead of echarts-for-react's default 300px height
        style={CHART_STYLE}
        className="time-chart-container" 
      />
    </div>
  )
}

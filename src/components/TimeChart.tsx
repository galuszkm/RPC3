import { useEffect, useRef, useState } from "react";
import { useChannels } from "../context/ChannelsContext";
import ReactECharts from "echarts-for-react";
import { fixedOptions } from "./TimeChartOptions";
import { Channel } from "../rpc3";
import TooltipIcon from "../icons/TooltipIcon";
import { Tooltip } from "primereact/tooltip";
import "./TimeChart.css";

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
  const chartRef = useRef<ReactECharts | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pointerActive, setPointerActive] = useState(false);

  // Get channels from context
  const { channels } = useChannels();

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
      window.addEventListener('resize', resizeChart)
      // Listen for 'dblclick' on the chart
      if (chartInstance.getZr()){
        chartInstance.getZr().on("dblclick", handleDoubleClick);
      }
    }
    // Cleanup listener on unmount
    return () => {
      if (chartInstance){
        window.removeEventListener('resize', resizeChart)
        if (chartInstance.getZr()){
          chartInstance.getZr().off("dblclick", handleDoubleClick);
        }
      }
    };
  }, []);

  // **Effect to Update Series & Y-Axis Name Dynamically**
  useEffect(() => {
    if (chartRef.current) {
      // Get chart instance
      const chartInstance = chartRef.current.getEchartsInstance();

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
          tooltip: {
            ...fixedOptions.tooltip,
            show: pointerActive,
          }
        },
        {
          notMerge: false,
          replaceMerge: ["series"]  // <--- Key to removing old series!
        }
      );
    }
  }, [channels]); // Re-run when channels change

  // Active tooltip
  useEffect(() => {
    if (chartRef.current) {
      // Get chart instance
      const chartInstance = chartRef.current.getEchartsInstance();
      // Update Chart
      chartInstance.setOption(
        {
          tooltip: {
            ...fixedOptions.tooltip,
            show: pointerActive,
          }
        }
      )
    }
  }, [pointerActive])

  // **Resize Chart When Splitter Resizing Ends**
  useEffect(() => {
    resizeChart()
  }, [resizeTrigger]);

  function resizeChart(){
    if (chartRef.current && wrapperRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      const wrapperHeight = wrapperRef.current.getBoundingClientRect().height;
      chartInstance.resize({height: wrapperHeight});
    }
  }

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
        className={"extra-toolbox-button-icon" + (pointerActive ? ' active': "")}
        onClick={() => setPointerActive(prev => !prev)}
      />
      <ReactECharts
        ref={chartRef} 
        option={fixedOptions} 
        className="time-chart-container" 
      />
    </div>
  )
}

import { useChannels } from "../context/ChannelsContext";
import ReactECharts from "echarts-for-react";
import { useEffect, useRef } from "react";
import { fixedOptions } from "./chartOptions";
import { Channel } from "../rpc3";
import "./Chart.css";

const generateData = (c: Channel) => {
  const len = c.value.length;
  const data = new Float64Array(len * 2);
  for (let i = 0; i < len; i++) {
    data[i * 2] = i * c.dt;  // X values (time)
    data[i * 2 + 1] = c.value[i]; // Y values (signal)
  }
  return data;
};

export default function Chart() {
  const { channels } = useChannels();
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
      if (chartInstance.getZr()){
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
            name: [...new Set(channels.map(c => c.Units))].map(i=>`[${i}]`).join(", ") ,
          }
        },
        {
          notMerge: false,
          replaceMerge: ["series"]  // <--- Key to removing old series!
        }
      );
    }
  }, [channels]); // Re-run when channels change

  return (
    <ReactECharts 
      ref={chartRef} 
      option={fixedOptions} 
      className="echarts-container" 
    />
  )
}

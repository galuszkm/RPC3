export const fixedOptions = {
    title: {},
    legend: {
      show: true,
      orient: "horizontal",
      left: 20,
      top: 0,
      itemGap: 20,
      formatter: (name: string) => (name.length > 33 ? name.substring(0, 30) + "..." : name),
    },
    toolbox: {
      feature: {
        dataZoom: { yAxisIndex: false },
        saveAsImage: { pixelRatio: 2 },
        dataView: { show: true },
      }
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      // formatter: tooltipFormatter,
    },
    grid: {
      left: 60, right: 30, top: 50, bottom: 80, containLabel: true
    },
    dataZoom: [
      { type: "inside", xAxisIndex: [0] },
      { type: "slider", xAxisIndex: [0] }
    ],
    xAxis: {
      type: "value",
      name: "",
      nameLocation: "middle",
      nameGap: 30,
      min: 'dataMin',
      max: 'dataMax',
      minorTick: {
        show: true,  // Show minor ticks (small divisions)
      },
      minorSplitLine: {
        show: true,  // Show minor grid lines (sublines)
        lineStyle: {
          color: "#ddd",   // Light gray color
          width: 1,       // Thin lines
          type: "dashed", // Dashed lines for better visibility
        },
      },
      splitLine: {
        show: true,  // Show main grid lines
        lineStyle: {
          color: "#cccaca",
          width: 1,      // Thicker main lines
        },
      },
      nameTextStyle: {
        fontSize: 14,
        fontFamily: "Inter var, sans-serif",
      },
      axisLabel: {
        fontSize: 13,
        fontFamily: "Inter var, sans-serif",
        color: "#555",
        formatter: (value: number) => value.toFixed(0), // Format X-axis labels
      },
    },
    yAxis: {
      type: "value",
      name: "",
      nameLocation: "middle",
      nameGap: 80,
      min: "dataMin",
      max: "dataMax",
      splitLine: { show: true },
      nameTextStyle: {
        fontSize: 14,
        fontFamily: "Inter var, sans-serif",
      },
      axisLabel: {
        fontSize: 13,
        fontFamily: "Inter var, sans-serif",
        color: "#555",
        formatter: (value: number) => value.toFixed(2), // Format Y-axis labels
      },
    },
    series: [] // Placeholder for dynamic series update
  };
  
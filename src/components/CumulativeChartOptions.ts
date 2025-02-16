const formatTooltipRow = (marker: string, seriesName: string, value: number) => {
  return `
    <div style="
      display: flex; 
      justify-content: space-between; 
      width: 100%;
      font-size: 13px;
    ">
      <span style="width: 240px; overflow: hidden; text-overflow: ellipsis; margin-right: 5px">${marker} ${seriesName}</span>
      <span style="width: 55px; text-align: right;">${value.toFixed(2)}</span>
    </div>
  `;
};

export const tooltipFormatter = (params: any, xTitle: string) => {
  // Extract unit from `xTitle` using regex
  const unitMatch = xTitle.match(/\[(.*?)\]$/);
  const unit = unitMatch ? unitMatch[1].replace('-', '') : "";
  const name = xTitle.replace(/\s*\[.*?\]$/, "");
  const xValue = Number(params[0].axisValue.toFixed(0)).toLocaleString("en-US").replace(/,/g, " ")

  let tooltipText = `
    <div 
      style="
      font-size: 13px; 
      margin-bottom: 5px; 
      font-weight: bold
    ">
    ${name}: ${xValue}${unit}
    </div>
  `;
  params.forEach((param: any) => {
    // Use the helper function to format each row
    tooltipText += formatTooltipRow(param.marker, param.seriesName, param.value[1],);
  });

  return `<div style="padding: 5px; min-width: 250px;">${tooltipText}</div>`;
};

export const fixedOptions = {
  title: {},
  legend: {
    show: true,
    orient: "vertical",
    right: 0,
    top: 0,
    itemGap: 10,
    textStyle: {
      overflow: 'truncate',
      width: 210,
    },
  },
  toolbox: {
    feature: {
      dataZoom: { yAxisIndex: false },
      saveAsImage: { pixelRatio: 2 },
      dataView: { show: true },
    },
    right: 255,
  },
  tooltip: {
    trigger: "axis",
    axisPointer: { type: "line" },
  },
  grid: {
    left: 50, right: 260, top: 35, bottom: 80, containLabel: true
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
  
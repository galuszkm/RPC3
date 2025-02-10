const formatTooltipRow = (marker: string, seriesName: string, value: number, unit: string) => {
  return `
    <div style="
      display: flex; 
      justify-content: space-between; 
      width: 100%;
      font-size: 13px;
    ">
      <span style="width: 240px; overflow: hidden; text-overflow: ellipsis; margin-right: 5px">${marker} ${seriesName}</span>
      <span style="width: 55px; text-align: right;">${value.toFixed(2)}</span>
      <span style="width: 55px; text-align: left; margin-left: 8px">${unit ? `${unit}` : ""}</span>
    </div>
  `;
};

const tooltipFormatter = (params: any) => {
  let tooltipText = `
    <div 
      style="
      font-size: 13px; 
      margin-bottom: 5px; 
      font-weight: bold
    ">
    Time: ${params[0].axisValue.toFixed(3)} s
    </div>
  `;

  params.forEach((param: any) => {
    // Extract unit from `seriesName` using regex
    const unitMatch = param.seriesName.match(/\[(.*?)\]$/);
    const unit = unitMatch ? unitMatch[1] : "";
    const sName = param.seriesName.replace(/\s*\[.*?\]$/, "");
    // Use the helper function to format each row
    tooltipText += formatTooltipRow(param.marker, sName, param.value[1], unit);
  });

  return `<div style="padding: 5px; min-width: 250px;">${tooltipText}</div>`;
};

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
      right: 20,
      feature: {
        dataZoom: { yAxisIndex: false },
        saveAsImage: { pixelRatio: 2 },
      }
    },
    tooltip: {
      show: false,
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: tooltipFormatter,
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
      name: "Time (s)",
      nameLocation: "middle",
      nameGap: 30,
      min: 0,
      max: 'dataMax',
      splitLine: { show: false },
      nameTextStyle: {
        fontSize: 14,
        fontFamily: "Inter var, sans-serif",
      },
      axisLabel: {
        fontSize: 13,
        fontFamily: "Inter var, sans-serif",
        color: "#555",
      },
    },
    yAxis: {
      type: "value",
      name: "", // Will be updated dynamically
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
  
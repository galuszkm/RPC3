import{r as f,j as x}from"./index.js";import{E as h}from"./index-B9mShMQm.js";const y=(t,n,a)=>`
    <div style="
      display: flex; 
      justify-content: space-between; 
      width: 100%;
      font-size: 13px;
    ">
      <span style="width: 240px; overflow: hidden; text-overflow: ellipsis; margin-right: 5px">${t} ${n}</span>
      <span style="width: 55px; text-align: right;">${a.toFixed(2)}</span>
    </div>
  `,g=(t,n)=>{const a=n.match(/\[(.*?)\]$/),o=a?a[1].replace("-",""):"",i=n.replace(/\s*\[.*?\]$/,""),l=Number(t[0].axisValue.toFixed(0)).toLocaleString("en-US").replace(/,/g," ");let c=`
    <div 
      style="
      font-size: 13px; 
      margin-bottom: 5px; 
      font-weight: bold
    ">
    ${i}: ${l}${o}
    </div>
  `;return t.forEach(d=>{c+=y(d.marker,d.seriesName,d.value[1])}),`<div style="padding: 5px; min-width: 250px;">${c}</div>`},p={title:{},legend:{show:!0,orient:"vertical",right:0,top:0,itemGap:10,textStyle:{overflow:"truncate",width:210}},toolbox:{feature:{dataZoom:{yAxisIndex:!1},saveAsImage:{pixelRatio:2},dataView:{show:!0}},right:255},tooltip:{trigger:"axis",axisPointer:{type:"line"}},grid:{left:50,right:260,top:35,bottom:80,containLabel:!0},dataZoom:[{type:"inside",xAxisIndex:[0]},{type:"slider",xAxisIndex:[0]}],xAxis:{type:"value",name:"",nameLocation:"middle",nameGap:30,min:"dataMin",max:"dataMax",minorTick:{show:!0},minorSplitLine:{show:!0,lineStyle:{color:"#ddd",width:1,type:"dashed"}},splitLine:{show:!0,lineStyle:{color:"#cccaca",width:1}},nameTextStyle:{fontSize:14,fontFamily:"Inter var, sans-serif"},axisLabel:{fontSize:13,fontFamily:"Inter var, sans-serif",color:"#555",formatter:t=>t.toFixed(0)}},yAxis:{type:"value",name:"",nameLocation:"middle",nameGap:80,min:"dataMin",max:"dataMax",splitLine:{show:!0},nameTextStyle:{fontSize:14,fontFamily:"Inter var, sans-serif"},axisLabel:{fontSize:13,fontFamily:"Inter var, sans-serif",color:"#555",formatter:t=>t.toFixed(2)}},series:[]},u=(t,n)=>{const a=t.length,o=new Float64Array(a*2);for(let i=0;i<a;i++)o[i*2]=t[i],o[i*2+1]=n[i];return o};function S({x:t,y:n,name:a,xLabel:o="Cumulative [-]",yLabel:i="Range",xTypeLog:l=!1,eqSignals:c=[],eqSignalsName:d=[]}){const m=f.useRef(null);return f.useEffect(()=>{let r;const s=()=>{r.dispatchAction({type:"dataZoom",start:0,end:100})};return m.current&&(r=m.current.getEchartsInstance(),r.getZr()&&r.getZr().on("dblclick",s)),()=>{r&&r.getZr()&&r.getZr().off("dblclick",s)}},[]),f.useEffect(()=>{if(m.current){const r=m.current.getEchartsInstance(),s=[];for(let e=0;e<t.length;e++)s.push({type:"line",step:"start",name:a[e],dimensions:["x","y"],data:u(t[e],n[e]),showSymbol:!1,large:!0,sampling:"lttb",silent:!0,areaStyle:{opacity:.15},lineStyle:{width:3}});for(let e=0;e<c.length;e++)s.push({type:"line",step:"start",name:`Eq. signal ${d[e]}`,dimensions:["x","y"],data:u(...c[e]),showSymbol:!1,large:!0,sampling:"lttb",silent:!0,lineStyle:{width:3},color:"rgba(255,0,0,0.6)"});r.setOption({series:s,xAxis:{...p.xAxis,name:o,type:l?"log":"value",min:l?1:"dataMin"},yAxis:{...p.yAxis,name:i},tooltip:{...p.tooltip,formatter:e=>g(e,o)}},{notMerge:!1,replaceMerge:["series"]})}},[t,n,l,o,i,a]),x.jsx(h,{ref:m,option:p,className:"cumulative-chart-container"})}export{S as default};

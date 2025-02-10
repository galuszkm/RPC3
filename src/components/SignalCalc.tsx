import { useEffect, useState, useRef, RefObject, lazy, Suspense } from "react";
import { useChannels } from "../context/ChannelsContext";
import { Dialog } from "primereact/dialog";
import { Toast } from 'primereact/toast';
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { Tooltip } from 'primereact/tooltip';
import { TabView, TabPanel } from 'primereact/tabview';
import { 
  Channel, EventType, calcDamage, eqDmgSignal,
  cumulative_rainflow_data, combine_channels_range_counts,
  EquivalentSignalRow, 
} from "../rpc3";
import "./SignalCalc.css";

const CumulativeChart = lazy(() => import("./CumulativeChart"));

interface SignalCalcProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export default function SignalCalc({ open, setOpen }: SignalCalcProps) {
  // Local states
  const toast = useRef<Toast>(null);
  const [activeIndexChart, setActiveIndexChart] = useState<number>(0);
  const [activeIndexUtils, setActiveIndexUtils] = useState<number>(0);
  const [events, setEvents] = useState<EventType[]>([]);
  const [slope, setSlope] = useState(5);
  const [gate, setGate] = useState(5);
  const [blockNo, setBlockNo] = useState(5);
  const [minNoCycles, setMinNoCycles] = useState(250e3);
  const [combine, setCombine] = useState(false);
  
  // Chart data
  const [name, setName] = useState<string[]>([]);
  const [damage, setDamage] = useState<number[]>([])
  const [range, setRange] = useState<Float64Array[]>([]);
  const [ncum, setNcum] = useState<Float64Array[]>([]);
  const [dcum, setDcum] = useState<Float64Array[]>([]);
  const [lcX, setLcX] = useState<Float64Array[]>([]);
  const [lcY, setLcY] = useState<Float64Array[]>([]);
  const [eqSignals, setEqSignals] = useState<EquivalentSignalRow[][]>([]);
  const [eqSignalUnits, setEqSignalUnits] = useState<string[]>([]);
  const [eqSignalNames, setEqSignalNames] = useState<string[]>([]);

  // Get selected channels from context
  const { channels } = useChannels();

  // Update `events` only when `open` is true and `channels` change
  useEffect(() => {
    if (open) {
      const uniqueEventsMap = new Map<string, EventType>();
      channels.forEach((channel) => {
        const hash = String(channel.fileHash);
        if (!uniqueEventsMap.has(hash)) {
          uniqueEventsMap.set(hash, {
            name: String(channel.filename),
            hash,
            repetitions: 1, // Default repetitions to 1
          });
        }
      });
      // Convert Map to sorted array
      setEvents(Array.from(uniqueEventsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [open, channels]);

  // ============================================================
  // MIDDLEWARES

  const clearStates = () => {
    [
      setRange, setName, setNcum, setDcum, setLcX, setLcY, setDamage,
      setEqSignalNames, setEqSignalUnits, setEqSignals,
    ].forEach(set => set([]));
  }

  // Handle event repetitions change
  const handleEventRepetitionsChange = (hash: string, value: number) => {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.hash === hash ? { ...event, repetitions: value || 1 } : event
      )
    );
  };

  const groupChannelsByName = () => {
    return Object.entries(
      channels.reduce<Record<string, Channel[]>>((acc, channel) => {
        if (!acc[channel.Name]) {
          acc[channel.Name] = [];
        }
        acc[channel.Name].push(channel);
        return acc;
      }, {})
    );
  }

  const postErrorCalculations= (toast: RefObject<Toast | null>, title: string, chanName: string, evName?: string, error?: string) => {
    const messageElement = () => (
      <div className="toast-error-calculate">
        <b className="title">{title}</b><br/>
        {error ? <span>{error}<br/></span>: <></>}
        <b>Channel: {chanName}</b><br/>
        {evName ? <b>Event: {evName}</b> : <></>}
      </div>
    )
    toast.current?.show({
      severity: 'error', 
      summary: 'Error', 
      detail: messageElement(),
      life: 5000,
    });
  }

  const calcEqSignals = (channels: Channel[]) => {
    // Collect Channels rainflow cycles and repetitions
    const cycles = channels.map(c => c.cycles);
    const repetitions = channels.map(c => c.repetitions);
    // Try to calculate eq block signal
    try {
      return eqDmgSignal(cycles, repetitions, blockNo, minNoCycles, slope)
    } catch(error) {
      console.error(error);
      const evName = channels.length > 1 ? "Combined events" : channels[0].filename;
      const chanName = channels[0].Name;
      postErrorCalculations(toast, 'Could not compute Eq. Block Signal!', chanName, evName, String(error));
      return []
    }
  }

  const combineChannels = (name: string, channels: Channel[]): [string, Float64Array, number, Channel[]] => {
    // Combine channels to get combined range counts and residual cycles
    const {rangeCounts, residualCycles} = combine_channels_range_counts(channels, events);
    const dmg = calcDamage(slope, rangeCounts);
    
    // Create artifical channel for residuals and set its RF cycles
    const residualChannel = new Channel(999999, channels[0].Name, channels[0].Units, 1, channels[0].dt, 'Combined residuals');
    residualChannel.setRainflowCycles(residualCycles);
    residualChannel.repetitions = 1;
    
    // Create channels collection for further eq damage signal calculation
    const chan = [...channels, residualChannel];

    const evName = channels.length > 1 ? 'combined events': String(channels[0].filename)
    const serieName = `${name} - ${evName}`

    return [serieName, rangeCounts, dmg, chan]
  }

  const handleCalculate = () => {
    // Clear states and set loading
    clearStates()

    // Perform rainflow counting on all channels
    // Since we pass repetitions, channel.range_count will already include required repetitions
    // However if combined in ON we will not close the residuals
    // The will be collected from all events, multiplied and counted later on
    // If combined is OFF we close resiudals directly in channel rainflow counting
    channels.forEach(c => {
      try {
        c.clearRF();
        c.rainflow(events.find(i => i.hash == c.fileHash)?.repetitions || 1, !combine)
      } catch (error) {
        console.error(error)
        postErrorCalculations(toast, 'Rainflow counting failed!', c.Name, c.filename);
      }
    });

    // Combine channels if needed
    // Save data [name, rangeCounts, damage, Channels] in channelGroups buffer
    let channelGroups: [string, Float64Array, number, Channel[]][] = [];
    if (combine) {
      groupChannelsByName().forEach(
        ([name, chans]) => {channelGroups.push(combineChannels(name, chans))}
      );
    } else {
      // Treat each channel separatelly
      channelGroups = channels.map(i => [
        `${i.Name} - ${i.filename}`, i.range_counts,  i.damage(slope), [i]
      ])
    }

    // Collect cumulative data of all channels
    const __name__: string[] = [];
    const __range__: Float64Array[] = [];
    const __ncum__: Float64Array[] = [];
    const __dcum__: Float64Array[] = [];
    const __damage__: number[] = [];
    for (let c of channelGroups) {
      const [channelName, range_counts, dmg] = c;
      const { range, ncum, dcum } = cumulative_rainflow_data(range_counts, slope, gate);
      __name__.push(channelName);
      __range__.push(range);
      __ncum__.push(ncum);
      __dcum__.push(dcum);
      __damage__.push(dmg)
    }

    // Calculate equivalent block signals
    const eq_signals: EquivalentSignalRow[][] = [];
    const eq_units: string[] = [];
    const eq_names: string[] = [];
    channelGroups.forEach(i => {
      const chans = i[3];
      const eq_sig = calcEqSignals(i[3]);
      if (eq_sig) {
        eq_signals.push(eq_sig);
        eq_units.push(chans[0].Units);
        eq_names.push(i[0]);
      }
    })
    setEqSignals(eq_signals);
    setEqSignalUnits(eq_units);
    setEqSignalNames(eq_names);

    // Set states
    setName(__name__);
    setRange(__range__);
    setNcum(__ncum__);
    setDcum(__dcum__);
    setDamage(__damage__);
    lcX;lcY;
  }

  const handleClose = () => {
    setOpen(false);
    clearStates();
  }

  // ============================================================
  // RENDER FUNCTIONS

  // Render event table
  const renderEventTable = () => (
    <div className="utils-table-root">
      <table className="utils-table">
        <thead>
          <tr>
            <th className="name">Event name</th>
            <th className="repetitions">Repetitions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.hash}>
              <td>{e.name}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={e.repetitions}
                  onChange={(event) => handleEventRepetitionsChange(e.hash, Number(event.target.value))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderControls = () => (
    <div className="controls-box">
      {/* Wohler slope */}
      <div className="input-block">
        <label>Wohler slope</label>
        <input
          name="slope"
          type="number"
          min={1}
          value={slope}
          onChange={(event) => setSlope(Number(event.target.value) || 1)}
        />
        <span className="tip">
          Typical: 5 for steel, 10 for aluminum
        </span>
      </div>
      {/* Gate */}
      <div className="input-block">
        <label>Gate [%]</label>
        <input
          name="gate"
          type="number"
          min={0}
          max={20}
          value={gate}
          onChange={(event) => setGate(Number(event.target.value) > 20 ? 20 : Number(event.target.value))}
        />
        <span className="tip">
          Skip cycles with lower force range
        </span>
      </div>
      {/* Number of blocks */}
      <div className="input-block">
        <label>Block No</label>
        <input
          name="no-blocks"
          type="number"
          min={0}
          max={15}
          value={blockNo}
          onChange={(event) => setBlockNo(Number(event.target.value) > 15 ? 15 : Number(event.target.value))}
        />
        <span className="tip">
          Number of blocks in equivalent signal
        </span>
      </div>
      {/* Min number of cycle */}
      <div className="input-block">
        <label>Min cycles</label>
        <input
          name="min-cycles"
          type="number"
          min={1e4}
          max={1e6}
          value={minNoCycles}
          onChange={(event) => setMinNoCycles(Number(event.target.value))}
        />
        <span className="tip">
          Minimal number of cycles in eqivalent block signal (recommended {">"}250k)
        </span>
      </div>
    </div>
  );

  const renderDamageTable = () => (
    <div className="utils-table-root">
      <table className="utils-table">
        <thead>
          <tr>
            <th className="name">Channel Name</th>
            <th className="damage">Damage [-]</th>
          </tr>
        </thead>
        <tbody>
          {damage.map((i, idx) => (
            <tr key={String(i + idx)}>
              <td>{name[idx]}</td>
              <td>{i.toExponential(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTableEqSignal = (eqSignal: EquivalentSignalRow[], idx: number) => {
    const [chanName, evName] = eqSignalNames[idx].split(' - ');
    const units = eqSignalUnits[idx];
    return (
      <div className="eq-signal-item">
        <div className="eq-signal-table-title">
          <span><b>Channel:</b>{chanName}</span>
          <span><b>Event:</b>{evName}</span>
        </div>
        <table className="eq-signal-table utils-table">
          <thead>
            <tr>
              <th className="id"     >Block No</th>
              <th className="max"    >Max [{units}]</th>
              <th className="min"    >Min [{units}]</th>
              <th className="range"  >Range [{units}]</th>
              <th className="repets" >Repetitions [-]</th>
              <th className="percDmg">Percentage of total damage [%]</th>
              <th className="damage" >Damage of block [-]</th>
            </tr>
          </thead>
          <tbody>
            {eqSignal.map((i, idx) => (
              <tr key={idx+i[0]+i[1]+i[4]}>
                <td className="id"     >{idx+1}</td>
                <td className="max"    >{(i[1] + i[0]/2).toFixed(2)}</td>
                <td className="min"    >{(i[1] - i[0]/2).toFixed(2)}</td>
                <td className="range"  >{i[1].toFixed(2)}</td>
                <td className="repets" >{i[2].toLocaleString("en-US").split('.')[0].replace(/,/g, " ")}</td>
                <td className="damage%">{i[3].toFixed(1)}</td>
                <td className="damage" >{i[4].toExponential(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderButtons = () => (
    <div className="controls-box">
      {/* Combine events */}
      <div className="combine-events">
        <SelectButton 
          className="combine-events-button tooltip-target-combine-events"
          value={combine ? 'On' : 'Off'} 
          onChange={(e) => setCombine(e.value === "On")} 
          options={['Off', 'On']} 
        />
        <div className="title">
          Combine channels accros all events
        </div>
        <Tooltip target=".tooltip-target-combine-events" position="top">
          <div>
            Merge channels with the same name across events <br />
            into a single dataset for combined rainflow counting
          </div>
        </Tooltip>
      </div>
      <Button className="cbutton calculate" label="Calculate" onClick={handleCalculate} />
    </div>
  );

  const renderTabChart = () => {
    const rangeUnits = [...new Set(channels.map(c => c.Units))].map(i=>`[${i}]`).join(", ")
    return (
      <div className="chart">
        <TabView activeIndex={activeIndexChart} onTabChange={(e) => setActiveIndexChart(e.index)}>
          <TabPanel className="tab-panel" header="Cumulative Cycles">
            <Suspense fallback={<></>}>
              <CumulativeChart 
                x={ncum} 
                y={range} 
                name={name} 
                xTypeLog={true}
                xLabel="Cumulative cycles [-]" 
                yLabel={`Range ${rangeUnits}`}
              />
             </Suspense>
          </TabPanel>
          <TabPanel className="tab-panel" header="Percentage of total damage">
            <Suspense fallback={<></>}>
              <CumulativeChart 
                x={dcum} 
                y={range} 
                name={name} 
                xTypeLog={false}
                xLabel="Percentage of total damage [%]" 
                yLabel={`Range ${rangeUnits}`}
              />
             </Suspense>
          </TabPanel>
          <TabPanel className="tab-panel eq-signals" header="Eq block signals">
            <div className="eq-signal-root">
              {eqSignals.map((i, idx) => renderTableEqSignal(i, idx))}
            </div>
          </TabPanel>
        </TabView>
      </div>
    )
  }

  const renderTabUtils = () => {
    return (
      <div className="utils">
        <TabView activeIndex={activeIndexUtils} onTabChange={(e) => setActiveIndexUtils(e.index)}>
          <TabPanel className="tab-panel" header="Input data">
            {renderControls()}
            {renderEventTable()}
            {renderButtons()}
          </TabPanel>
          <TabPanel className="tab-panel" header="Results">
            {renderDamageTable()}
          </TabPanel>
        </TabView>
      </div>
    )
  }

  const headerElement = (
    <div className="signal-calc-header">
      <span className="title">Signal Processing</span>
    </div>
  );

  return (
    <Dialog
      className="signal-calc-dialog"
      header={headerElement}
      visible={open}
      maximizable
      onHide={handleClose}
    >
      <Toast ref={toast} />
      <div className="signal-calc-grid">
        {renderTabChart()}
        {renderTabUtils()}
      </div>
    </Dialog>
  );
}

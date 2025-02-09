import { useEffect, useState, useRef } from "react";
import { useChannels } from "../context/ChannelsContext";
import { Dialog } from "primereact/dialog";
import { Toast } from 'primereact/toast';
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { Tooltip } from 'primereact/tooltip';
import CumulativeChart from "./CumulativeChart";
import { Channel, cumulative_rainflow_data, EventType, combine_channels_range_counts, calcDamage } from "../rpc3";
import "./SignalCalc.css";

interface SignalCalcProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}


export default function SignalCalc({ open, setOpen }: SignalCalcProps) {
  // Local states
  const toast = useRef<Toast>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [slope, setSlope] = useState(5);
  const [gate, setGate] = useState(5);
  const [combine, setCombine] = useState(false);
  
  // Chart data
  const [name, setName] = useState<string[]>([]);
  const [damage, setDamage] = useState<number[]>([])
  const [range, setRange] = useState<Float64Array[]>([]);
  const [ncum, setNcum] = useState<Float64Array[]>([]);
  const [dcum, setDcum] = useState<Float64Array[]>([]);
  const [lcX, setLcX] = useState<Float64Array[]>([]);
  const [lcY, setLcY] = useState<Float64Array[]>([]);

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
    [setRange, setName, setNcum, setDcum, setLcX, setLcY, setDamage].forEach(set => set([]));
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
        toast.current?.show({
          severity: 'error', 
          summary: 'Error', 
          detail: (<>Rainflow counting failed!<br/>Channel: {c.Name}<br/>Event: {c.filename}</>),
        });
      }
    });

    // Combine channels if needed
    // Save data [name, range_counts, damage] in channelGroups buffer
    let channelGroups: [string, Float64Array, number][] = [];
    if (combine) {
      channelGroups = groupChannelsByName().map(([name, channels]) => {
        const rngCounts = combine_channels_range_counts(channels, events);
        const dmg = calcDamage(slope, rngCounts) 
        return [
          `${name} - ${channels.length > 1 ? 'combined events': channels[0].filename}`, 
          rngCounts, dmg
        ]
      });
    } else {
      channelGroups = channels.map(i => [`${i.Name} - ${i.filename}`, i.range_counts, i.damage(slope)])
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
    // Set states
    setName(__name__);
    setRange(__range__);
    setNcum(__ncum__);
    setDcum(__dcum__);
    setDamage(__damage__);
  }

  const handleClose = () => {
    setOpen(false);
    clearStates();
  }

  // ============================================================
  // RENDER FUNCTIONS

  // Render event table
  const renderEventTable = () => (
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
          Typical 5 for steel, 10 for aluminum
        </span>
      </div>
      {/* Gate */}
      <div className="input-block" style={{paddingBottom: 0}}>
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
          Ignore load range threshold
        </span>
      </div>
    </div>
  )

  const renderDamageTable = () => (
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
  )

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
  )

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
        <div className="chart">
          <CumulativeChart x={ncum} y={range} name={name} xTypeLog={true} />
        </div>
        <div className="utils">
          {renderControls()}
          {renderEventTable()}
          {renderButtons()}
          {damage.length ? renderDamageTable() : <></>}
        </div>
      </div>
    </Dialog>
  );
}

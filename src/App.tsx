import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primeicons/primeicons.css';
import { useState, lazy, Suspense, useRef } from 'react';
import { FilesProvider } from "./context/FilesContext";
import { ChannelsProvider, useChannels } from './context/ChannelsContext';
import { EventsProvider } from './context/EventContext';
import Dropzone from './components/Dropzone';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import "./App.css";

const TimeChart = lazy(() => import("./components/TimeChart"));
const SignalCalc = lazy(() => import("./components/SignalCalc"));
const ChannelTable = lazy(() => import("./components/ChannelTable"));

const renderSplitter = () => {
  const [resizeTrigger, setResizeTrigger] = useState(0);
  return (
    <Splitter
      className="App-grid-split"
      style={{ height: "96vh", border: "none" }}
      layout="vertical"
      gutterSize={7}
      onResizeEnd={() => setResizeTrigger((prev) => prev + 1)} // Update state when resizing stops
    >
      <SplitterPanel size={45} minSize={2} style={{ overflow: "hidden", height: "44vh" }}>
        <Suspense fallback={<></>}>
          <TimeChart resizeTrigger={resizeTrigger} />
        </Suspense>
      </SplitterPanel>
      <SplitterPanel size={55} minSize={10} style={{ overflow: "auto", paddingTop: "0.5rem" }}>
        <Suspense fallback={<></>}>
          <ChannelTable />
        </Suspense>
      </SplitterPanel>
    </Splitter>
  )
}

function renderRightColumn(toast: React.RefObject<Toast | null>) {
  // Local states
  const [signalCalcOpen, setSignalCalcOpen] = useState(false);
  // Get selected channels from context
  const { channels } = useChannels();

  const handleOpenSignalCalc = () => {
    if (channels.length){
      setSignalCalcOpen(true)
    } else {
      toast.current?.show({
        severity: 'error', 
        summary: 'Error', 
        detail: 'At least one channel must be selected!',
      });
    }
  }

  return (
    <div className='App-grid-utils-box'>
      <div className='App-dropzone'>
          <Dropzone />
      </div>
      <div className='App-utils'>
        <Button 
          className='cbutton'
          style={{width: '100%'}}
          label="Calculate damage and equivalent block signal" 
          icon="pi pi-wrench" 
          onClick={handleOpenSignalCalc}
        />
      </div>
      <Suspense fallback={<></>}>
        <SignalCalc open={signalCalcOpen} setOpen={setSignalCalcOpen}/>
      </Suspense>
    </div>
  )
}

function App() {
  // Local states and refs
  const toast = useRef<Toast>(null);

  return (
    <div className='App-grid'>
      <Toast ref={toast} />
      {renderSplitter()}
      {renderRightColumn(toast)}
    </div>
  )
}

export default function AppWrapper() {
  return (
    <FilesProvider>
      <EventsProvider>
        <ChannelsProvider>
          <App />
        </ChannelsProvider>
      </EventsProvider>
    </FilesProvider>
  )
}
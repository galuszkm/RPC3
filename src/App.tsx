import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primeicons/primeicons.css';
import { useState, lazy, Suspense, useRef } from 'react';
import { FilesProvider } from "./context/FilesContext";
import { ChannelsProvider, useChannels } from './context/ChannelsContext';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import SignalCalc from './components/SignalCalc';
import Dropzone from "./components/Dropzone";
import ChannelTable from './components/ChannelTable';
import "./App.css";

const LazyChart = lazy(() => import("./components/TimeChart"));

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
          <LazyChart resizeTrigger={resizeTrigger} />
        </Suspense>
      </SplitterPanel>
      <SplitterPanel size={55} minSize={10} style={{ overflow: "auto", paddingTop: "0.5rem" }}>
        <ChannelTable />
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
      <SignalCalc open={signalCalcOpen} setOpen={setSignalCalcOpen}/>
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
      <ChannelsProvider>
        <App />
      </ChannelsProvider>
    </FilesProvider>
  )
}
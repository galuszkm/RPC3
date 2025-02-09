import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primeicons/primeicons.css';
import { useState, lazy, Suspense } from 'react';
import { FilesProvider } from "./context/FilesContext";
import { ChannelsProvider } from './context/ChannelsContext';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Button } from 'primereact/button';
import SignalCalc from './components/SignalCalc';
import Dropzone from "./components/Dropzone";
import ChannelTable from './components/ChannelTable';
import "./App.css";

const LazyChart = lazy(() => import("./components/TimeChart"));

const renderSplitter = () => (
  <Splitter className='App-grid-split' style={{ height: '96vh', border: 'none' }} layout="vertical" gutterSize={6}>
    <SplitterPanel size={45} minSize={20} style={{ overflow: 'hidden', height: '44vh'}} >
      <Suspense fallback={<></>}>
        <LazyChart />
      </Suspense>
    </SplitterPanel>
    <SplitterPanel size={55} minSize={10} style={{ overflow: 'auto', paddingTop: '0.5rem' }} >
      <ChannelTable />
  </SplitterPanel>
  </Splitter>
)

const renderRightColumn = () => {
  // Local states
  const [signalCalcOpen, setSignalCalcOpen] = useState(false);

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
          onClick={() => setSignalCalcOpen(true)}
        />
      </div>
      <SignalCalc open={signalCalcOpen} setOpen={setSignalCalcOpen}/>
    </div>
  )
}

export default function App() {
  return (
    <FilesProvider>
      <ChannelsProvider>
        <div className='App-grid'>
          {renderSplitter()}
          {renderRightColumn()}
        </div>
      </ChannelsProvider>
    </FilesProvider>
  )
}
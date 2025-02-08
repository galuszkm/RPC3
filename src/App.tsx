import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primeicons/primeicons.css';
import { FilesProvider } from "./context/FilesContext";
import { ChannelsProvider } from './context/ChannelsContext';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Button } from 'primereact/button';
import Dropzone from "./components/Dropzone";
import Chart from "./components/Chart";
import ChannelTable from './components/ChannelTable';
import "./App.css";

const renderSplitter = () => (
  <Splitter className='App-grid-split' style={{ height: '96vh', border: 'none' }} layout="vertical" gutterSize={6}>
    <SplitterPanel size={50} minSize={20} style={{ overflow: 'hidden'}} >
      <Chart />
    </SplitterPanel>
    <SplitterPanel size={50} minSize={20} style={{ overflow: 'auto', paddingTop: '0.5rem' }} >
      <ChannelTable />
  </SplitterPanel>
  </Splitter>
)

const renderRightColumn = () => (
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
        onClick={()=>{}}
      />
    </div>
  </div>
)

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
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primeicons/primeicons.css';
import { FilesProvider } from "./context/FilesContext";
import { ChannelsProvider } from './context/ChannelsContext';
import Dropzone from "./components/Dropzone";
import Chart from "./components/Chart";
import ChannelTable from './components/ChannelTable';
import "./App.css"

export default function App() {
  return (
    <FilesProvider>
      <ChannelsProvider>
        <div className='App-grid'>
          <div className='App-grid-chart'>
            <Chart />
            <ChannelTable />
          </div>
          <div className='App-grid-dropzone'>
            <Dropzone />
          </div>
        </div>
      </ChannelsProvider>
    </FilesProvider>
  )
}
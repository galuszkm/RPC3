import { useRef, useState } from 'react';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { RPC } from '../rpc3';
import { Buffer } from 'buffer';
import { useFiles } from "../context/FilesContext"; 
import { useChannels } from '../context/ChannelsContext';
import DownloadExampleButton from './DownloadExampleButton';
import "./Dropzone.css";

const handleFileReading = (f: File): Promise<RPC> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(f);

    fileReader.onload = () => {
      if (!fileReader.result) {
        return reject(new Error(`Failed to read file: ${f.name}`));
      }
      // Convert ArrayBuffer to Node.js Buffer
      const arrayBuffer = fileReader.result as ArrayBuffer;
      const buffer = Buffer.from(arrayBuffer); // Convert to Buffer
      // Create RPC instance
      const rpc = new RPC(buffer, f.name, false);
      rpc.lastModified = new Date(f.lastModified);
      // Parse
      if (rpc.parse()) {
        resolve(rpc);
      } else {
        reject(new Error(`Parsing failed for file: ${f.name}`));
      }
    };
    fileReader.onerror = () => {
      reject(new Error(`File reading error for: ${f.name}`));
    };
  });
};

export default function Dropzone() {
  // Local states and refs
  const toast = useRef<Toast>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use context to manage the files upload
  const { files, addFile, removeFile } = useFiles(); 
  const { removeFileChannels } = useChannels();

  // ============================================================
  // MIDDLEWARES

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent default browser behavior (e.g., opening the file)
    setIsDragging(false);
    setIsLoading(true);
    let droppedFiles: File[] = Array.from(e.dataTransfer?.files || []);

    // Read all dragged files
    await Promise.all(
      droppedFiles.map(async (file) => {
        try {
          const rpc = await handleFileReading(file);
          addFile(rpc); // Dispatch ADD_FILE to context
        } catch (error) {
          toast.current?.show({
            severity: 'error', 
            summary: 'Error', 
            detail: `Failed to process file: ${file.name}`,
          });
        }
      }
    ));
    // Disable loading
    setIsLoading(false)
  };

  const handleFileRemove = (hash: string) => {
    removeFile(hash)
    removeFileChannels(hash)
  };

  // ============================================================
  // RENDER FUNCTIONS

  const renderFileRow = (file: RPC, idx:number) => {
    return (
      <div className="dropzone-file-row" key={file.hash + idx}>
        <div className="title">
          <span>{file.fileName}</span>
        </div>
        <div className='utils'>
          <Tag value={file.fileSize} severity="warning" className="px-3 py-2" />
          <Button 
            type="button" 
            icon="pi pi-times" 
            className="p-button-outlined p-button-rounded p-button-danger ml-auto" 
            onClick={() => handleFileRemove(file.hash)}
          />
        </div>
      </div>
    );
  };

  const renderDropboxInfoMark = () => {
    return (
      <div className='dropzone-box-empty' style={{opacity: Math.max(1-0.2*files.length, 0)}}>
        <i 
          className="pi pi-download mt-3 p-5" 
          style={{fontSize: '5em', borderRadius: '50%', color: '#cbcdd0'}}
        />
        <span style={{ fontSize: '1.2em', color: 'var(--text-color-secondary)' }} className="my-5">
          Drag and Drop Signal Files Here
        </span>
      </div>
    );
  };

  // Render loading spinner or file list
  const renderDropboxContent = () => {
    if (isLoading){
      return (
        <div className="overlay" style={{background: 'none'}}>
          <div className="loading-box">
            <div className="spinner" />
          </div>
          <span style={{ fontSize: '1.3rem', color: 'var(--text-color-secondary)' }}>
            Loading data ...
          </span>
        </div>
      )
    }
    return (
      <>
        {files.map((i, idx) => renderFileRow(i, idx))}
        {renderDropboxInfoMark()}
      </>
    )
  }

  const renderDropbox = () => (
    <div 
        className={`lex align-items-center flex-column dropzone-box ${isDragging ? "dragover" : ""}`}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
     >
      {renderDropboxContent()}
     </div>
  )

  return (
    <div className='dropzone-root'>
      <Toast ref={toast} />
      <div className='dropzone-header'>
        <div className='dropzone-title'>Loaded files</div>
        <DownloadExampleButton />
      </div>
      {renderDropbox()}
    </div>
  );
}

import React, { RefObject } from "react";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { RPC } from "../rpc3";
import { useFiles } from "../context/FilesContext";
import "./DownloadExampleButton.css";

// Function to show error toast
const toastError = (toast: RefObject<Toast | null>) => {
  toast.current?.show({
    severity: "error",
    summary: "Error",
    detail: "Failed to fetch signal example",
  });
};

// Define props interface
interface DownloadExampleButtonProps {
  handleFileReading: (file: File) => Promise<RPC | null>;
  toast: RefObject<Toast | null>;
}

const DownloadExampleButton: React.FC<DownloadExampleButtonProps> = ({ handleFileReading, toast }) => {
  // Get loaded files from context
  const { files } = useFiles();

  // File download handler
  const handleDownload = async () => {
    try {
      const fileUrl = "/getExample"; // Proxy route to fetch the file
      const response = await fetch(fileUrl);

      // Check if response status is ok
      if (!response.ok) {
        toastError(toast);
        return
      }
      const blob = await response.blob();
      const fileNo = String(files.length+1).padStart(2, "0");
      const fname = `${fileNo}_Example`
      const file = new File([blob], fname, { type: blob.type, lastModified: Date.now() });

      // Pass the file to handleFileReading
      const rpc = await handleFileReading(file);
      if (rpc){
        // Scale all channels values to introduce some randomness
        // Scale factor is random float in range 1 to 3
        rpc?.Channels.forEach(c => c.scaleValue(Math.random()*(3-1)+1))
      }

    } catch (error) {
      toastError(toast)
      console.error(error);
    }
  };

  return (
    <Button 
      className="cbutton download-example" 
      label="Load signal example" 
      icon="pi pi-download" 
      onClick={handleDownload} 
    />
  );
};

export default DownloadExampleButton;
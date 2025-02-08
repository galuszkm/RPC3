import React from "react";
import { Button } from "primereact/button";
import "./DownloadExampleButton.css";

const DownloadExampleButton: React.FC = () => {
  const handleDownload = () => {
    const fileUrl = "/getExample"; // Use the proxy route
    const link = document.createElement("a");
    link.href = fileUrl;
    link.setAttribute("download", "SignalExample.rsp"); // Force download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button 
      className="cbutton download-example" 
      label="Download example" 
      icon="pi pi-download" 
      onClick={handleDownload} 
    />
  );
};

export default DownloadExampleButton;
import React, { useMemo, useState } from "react";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import { DataTable, DataTableFilterMeta, DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { useFiles } from "../context/FilesContext";
import { useChannels } from "../context/ChannelsContext";
import { Channel } from "../rpc3/src/channel";
import "./ChannelTable.css";

interface ChannelType {
  id: string;
  fileName: string;
  channelName: string;
  units: string;
  max: number;
  min: number;
  channelRef: Channel, 
}

const ChannelTable: React.FC = () => {
  // Contexts
  const { files } = useFiles();             // Get files from context
  const { setChannels } = useChannels();    // Selected channels dispatch

  // Local states with selected channels for DataTable
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>([])

  // Filter state
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.IN },
    fileName: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.IN }] },
    channelName: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.IN }] },
    units: { value: null, matchMode: FilterMatchMode.IN },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState<string>('');

  // Transform Files to Table Data
  const tableData = useMemo<ChannelType[]>(() => {
    return files.flatMap((rpc) =>
      rpc.Channels.map((channel) => ({
        id: rpc.hash + channel.Name,
        fileName: rpc.fileName,
        channelName: channel.Name,
        units: channel.Units,
        max: Math.round(channel.max*1e3)/1e3,
        min: Math.round(channel.min*1e3)/1e3,
        channelRef: channel
      }))
    );
  }, [files]);

  // ============================================================
  // MIDDLEWARES

  // Handle global filter change
  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let _filters = { ...filters };
    if ('value' in _filters.global){
      _filters.global.value = value;
    }
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const handleSelectionChange = (e: DataTableSelectionMultipleChangeEvent<ChannelType[]>) => {
    let selected = e.value as ChannelType[];
    // Ensure that all selected channels belong to existing files
    // Bug occured when file was removed but its selected channel was still in e.value 
    const validHash = files.map(f => f.hash)
    selected = selected.filter(c => validHash.includes(String(c.channelRef.fileHash)));
    // Set new selected channels to state and context
    setSelectedChannels(selected);
    setChannels(selected.map(i => i.channelRef));
  }

  // ============================================================
  // RENDER FUNCTIONS

  const renderHeader = () => {
    return (
      <div className="channel-table-header">
        <h4 className="title">Available channels</h4>
        <IconField iconPosition="left">
          <InputIcon className="pi pi-search" />
          <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Search ..." className="filter-global" />
        </IconField>
      </div>
    );
  };

  return (
    <DataTable 
      value={tableData}
      className="channel-table"
      paginator 
      rows={10} 
      header={renderHeader()}
      showGridlines
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
      rowsPerPageOptions={[10, 25, 50]} 
      dataKey="id" 
      selection={selectedChannels}
      selectionMode="checkbox"
      onSelectionChange={handleSelectionChange}
    >
      {/* Selection column */}
      <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
      {/* File Name Column with Filter */}
      <Column
        field="fileName"
        header="File name"
        sortable 
        filter 
        filterPlaceholder="Search by file" 
        style={{ minWidth: '6rem', maxWidth: '20rem' }}
      />
      {/* Channel Name Column with Filter */}
      <Column
        field="channelName"
        header="Channel Name"
        sortable
        filter 
        filterPlaceholder="Search by name" 
        style={{ minWidth: '6rem', maxWidth: '20rem' }}
      />
      {/* Units Column with Filter */}
      <Column
        field="units"
        header="Units"
        sortable
        filter
        filterPlaceholder="Search by unit" 
        style={{ width: '10rem' }}
      />
      {/* Max Column (No Filter) */}
      <Column field="max" header="Max" sortable style={{ width: '8rem' }}/>
      {/* Min Column (No Filter) */}
      <Column field="min" header="Min" sortable style={{ width: '8rem' }}/>
    </DataTable>
  );
};

export default ChannelTable;

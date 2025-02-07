import React, { createContext, useReducer, useContext, ReactNode } from "react";
import { Channel } from "../rpc3";

// Type definitions
interface ChannelState {
  channels: Channel[];
}

type ChannelsAction = 
| { type: "SET_CHANNELS"; payload: Channel[] }
| { type: "REMOVE_CHANNELS_BY_FILEHASH"; payload: string }

// Reducer function
const channelsReducer = (state: ChannelState, action: ChannelsAction): ChannelState => {
  switch (action.type) {
    case "SET_CHANNELS":
      return { channels: action.payload };
    case "REMOVE_CHANNELS_BY_FILEHASH":
      return { channels: state.channels.filter(i => i.fileHash != action.payload) };
    default:
      return state;
  }
};

// Context Type
interface ChannelContextType {
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  removeFileChannels: (hash: string) => void;
}

// Create context
const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

// Provider component
export const ChannelsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(channelsReducer, { channels: [] });
  const setChannels = (channels: Channel[]) => dispatch({ type: "SET_CHANNELS", payload: channels });
  const removeFileChannels = (hash: string) => dispatch({ type: "REMOVE_CHANNELS_BY_FILEHASH", payload: hash });

  return (
    <ChannelContext.Provider value={{ channels: state.channels, setChannels , removeFileChannels}}>
      {children}
    </ChannelContext.Provider>
  );
};

// Custom hook for using context
export const useChannels = (): ChannelContextType => {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error("useChannels must be used within a ChannelsProvider");
  }
  return context;
};

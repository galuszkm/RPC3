import React, { createContext, useReducer, useContext, ReactNode } from "react";
import { RPC } from "../rpc3";

// Type definitions
interface FilesState {
  files: RPC[];
}

type FilesAction =
  | { type: "ADD_FILE"; payload: RPC }
  | { type: "REMOVE_FILE"; hash: string };

// Reducer function
const filesReducer = (state: FilesState, action: FilesAction): FilesState => {
  switch (action.type) {
    case "ADD_FILE":
      return { ...state, files: [...state.files, action.payload] };

    case "REMOVE_FILE":
      return { ...state, files: state.files.filter((file) => file.hash !== action.hash) };

    default:
      return state;
  }
};

// Context Type
interface FilesContextType {
  files: RPC[];
  addFile: (file: RPC) => void;
  removeFile: (hash: string) => void;
}

// Create context
const FilesContext = createContext<FilesContextType | undefined>(undefined);

// Provider component
export const FilesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(filesReducer, { files: [] });
  const addFile = (file: RPC) => dispatch({ type: "ADD_FILE", payload: file });
  const removeFile = (hash: string) => dispatch({ type: "REMOVE_FILE", hash });

  return (
    <FilesContext.Provider value={{ files: state.files, addFile, removeFile }}>
      {children}
    </FilesContext.Provider>
  );
};

// Custom hook for using context
export const useFiles = (): FilesContextType => {
  const context = useContext(FilesContext);
  if (!context) {
    throw new Error("useFiles must be used within a FilesProvider");
  }
  return context;
};

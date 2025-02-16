
import React, { createContext, useReducer, useContext, ReactNode } from "react";
import { EventType } from "../rpc3";

// Updated state type
interface EventState {
  events: Record<string, EventType>;
}

type EventsAction = 
  | { type: "SET_EVENTS"; payload: Record<string, EventType> }
  | { type: "SET_EVENT"; payload: EventType };

// Updated reducer function
const eventsReducer = (state: EventState, action: EventsAction): EventState => {
  switch (action.type) {
    case "SET_EVENTS":
      return { events: { ...action.payload } };

    case "SET_EVENT":
      return { 
        events: { 
          ...state.events, 
          [action.payload.hash]: action.payload // Overwrite existing event by hash
        }
      };

    default:
      return state;
  }
};

// Updated context type
interface EventContextType {
  events: Record<string, EventType>;
  setEvents: (events: Record<string, EventType>) => void;
  setEvent: (event: EventType) => void;
}

// Create context
const EventContext = createContext<EventContextType | undefined>(undefined);

// Provider component
export const EventsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(eventsReducer, { events: {} });

  const setEvents = (events: Record<string, EventType>) => 
    dispatch({ type: "SET_EVENTS", payload: events });

  const setEvent = (event: EventType) => 
    dispatch({ type: "SET_EVENT", payload: event }); // New function to overwrite an event

  return (
    <EventContext.Provider value={{ events: state.events, setEvents, setEvent }}>
      {children}
    </EventContext.Provider>
  );
};

// Custom hook for using context
export const useEvents = (): EventContextType => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvents must be used within a EventsProvider");
  }
  return context;
};

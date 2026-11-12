/**
 * Persisted time zone preference for the header clock.
 * Defaults to Indian Standard Time; "local" follows the browser's zone.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export const TIME_ZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "local", label: "My device time zone" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London", label: "United Kingdom" },
  { value: "Europe/Paris", label: "Central Europe" },
  { value: "Asia/Dubai", label: "UAE (GST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Japan" },
  { value: "Australia/Sydney", label: "Australia (Sydney)" },
];

interface TimeZoneState {
  timeZone: string;
  setTimeZone: (timeZone: string) => void;
}

export const TIME_ZONE_STORAGE_KEY = "dataworkbench:time-zone";

export const useTimeZoneStore = create<TimeZoneState>()(
  persist(
    (set) => ({
      timeZone: DEFAULT_TIME_ZONE,
      setTimeZone: (timeZone) => set({ timeZone }),
    }),
    { name: TIME_ZONE_STORAGE_KEY }
  )
);

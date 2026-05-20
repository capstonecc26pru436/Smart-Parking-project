"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";

// ==========================================
// 1. Tipe Data (Types) & Interfaces
// ==========================================

export interface Config {
  harga_per_jam: number; // Harga parkir per jam (Integer)
  demo_mode: boolean; // Menandakan apakah sistem dalam mode demo (Boolean)
}

export interface Slot {
  id: string; // Contoh: 'A01', 'A02'
  status: "kosong" | "terisi"; // Status slot saat ini
  location: string; // Contoh: 'Blok A'
}

export interface ActiveVehicle {
  ticketId: string; // Contoh: 'TIX-001'
  slotId: string; // Contoh: 'A01'
  checkInTime: number; // Timestamp ketika kendaraan masuk
}

export interface ExitProcessData {
  ticketId: string;
  durationString: string;
  totalCost: number;
}

export interface LogEntry {
  id: string;
  type: "in" | "out";
  timestamp: number;
}

interface ParkingContextType {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  slots: Slot[];
  setSlots: React.Dispatch<React.SetStateAction<Slot[]>>;
  activeVehicles: ActiveVehicle[];
  setActiveVehicles: React.Dispatch<React.SetStateAction<ActiveVehicle[]>>;
  exitProcessData: ExitProcessData | null;
  setExitProcessData: React.Dispatch<
    React.SetStateAction<ExitProcessData | null>
  >;
  paymentSuccess: boolean;
  setPaymentSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  isManualClose: boolean;
  setIsManualClose: React.Dispatch<React.SetStateAction<boolean>>;
  isSlowInternet: boolean;
  lastSyncTime: number | null;
  syncToDB: (action: string, payload: any) => Promise<boolean>;
}

// ==========================================
// 2. Inisiasi Data Awal (Initial State)
// ==========================================

// Membuat Array berisi 24 slot parkir (12 di Blok A, 12 di Blok B)
const defaultSlots: Slot[] = Array.from({ length: 24 }, (_, i) => {
  const isBlockA = i < 12;
  const block = isBlockA ? "A" : "B";
  const num = (i % 12) + 1;
  const id = `${block}${num.toString().padStart(2, "0")}`;

  return {
    id,
    status: "kosong",
    location: `Blok ${block}`,
  };
});

// Membuat Context
const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

// ==========================================
// 3. Provider Component
// ==========================================

/**
 * ParkingProvider digunakan untuk membungkus komponen di aplikasi kita
 * agar semua komponen turunan bisa mengakses state parkir secara global.
 */
export function ParkingProvider({ children }: { children: ReactNode }) {
  // State untuk Config
  const [config, setConfig] = useState<Config>({
    harga_per_jam: 5000,
    demo_mode: false,
  });

  // State untuk Data Slot Parkir
  const [slots, setSlots] = useState<Slot[]>(defaultSlots);

  // State untuk Kendaraan yang sedang Aktif/Parkir
  const [activeVehicles, setActiveVehicles] = useState<ActiveVehicle[]>([]);

  // State untuk Layar Pintu Keluar
  const [exitProcessData, setExitProcessData] =
    useState<ExitProcessData | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // State untuk Log Keluar/Masuk
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // State untuk Fitur Baru (Slow Internet & Manual Close)
  const [isManualClose, setIsManualClose] = useState<boolean>(false);
  const [isSlowInternet, setIsSlowInternet] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Mengambil state secara global dari Context (Initial data)
  const fetchFullDB = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/sync?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.config) setConfig(data.config);
      if (data.slots && data.slots.length > 0) setSlots(data.slots);
      if (data.activeVehicles) setActiveVehicles(data.activeVehicles);
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error("Failed to fetch full data:", e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFullDB();
  }, [fetchFullDB]);

  // Broadcast channel untuk sinkronisasi antar-tab seketika
  useEffect(() => {
    const channel = new BroadcastChannel('parking_sync');
    channel.onmessage = (event) => {
      if (event.data === 'sync_needed') {
        fetchFullDB();
      }
    };
    return () => channel.close();
  }, [fetchFullDB]);

  // Fungsi utilitas untuk sinkronisasi DB (tanpa memblokir UI)
  const syncToDB = React.useCallback(async (action: string, payload: any) => {
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      // Langsung panggil fetchFullDB di klien saat ini
      await fetchFullDB();

      // Beritahu tab lain untuk sync state dari DB seketika itu juga
      const channel = new BroadcastChannel('parking_sync');
      channel.postMessage('sync_needed');
      channel.close();
      
      return true;
    } catch (e) {
      console.error("DB Sync failed:", e);
      alert("Error: Gagal menyinkronkan data dengan database. Silakan periksa koneksi Anda dan coba lagi.");
      return false;
    }
  }, [fetchFullDB]);

  // Polling Real-time data database via Prisma for cross-device sync
  useEffect(() => {
    const pollFullDB = async () => {
      // Jika mode internet lambat aktif, tunda fetching (simulasi)
      if (isSlowInternet) return;
      try {
        const res = await fetch(`/api/sync?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Gagal sync data");
        const data = await res.json();

        if (data.config) setConfig(data.config);
        if (data.slots && data.slots.length > 0) {
          setSlots(
            data.slots.map((s: any) => ({
              id: s.id,
              status: s.status,
              location: `Blok ${s.id.startsWith("A") || s.id.startsWith("F1") ? "A" : "B"}`,
            }))
          );
        }
        if (data.activeVehicles) setActiveVehicles(data.activeVehicles);
        if (data.logs) setLogs(data.logs);
      } catch (e) {
        console.error("Failed to sync realtime slots:", e);
      }
    };

    // Poll DB every 2 seconds for near-real-time updates
    const intervalId = setInterval(pollFullDB, 2000);
    return () => clearInterval(intervalId);
  }, [isSlowInternet]);

  // Efek Simulasi Internet Lemot
  useEffect(() => {
    const latensiInterval = setInterval(() => {
      const isSlow = Math.random() > 0.7; // 30% chance internet lambat
      setIsSlowInternet(isSlow);
      if (isSlow) {
        setLastSyncTime(Date.now() - Math.floor(Math.random() * 5 * 60 * 1000)); // last sync 0-5 mins ago
      } else {
        setLastSyncTime(Date.now());
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(latensiInterval);
  }, []);

  // Ref untuk menghindari stale closure di dalam setInterval Demo Mode
  const stateRef = useRef({ slots, activeVehicles, exitProcessData, config });
  useEffect(() => {
    stateRef.current = { slots, activeVehicles, exitProcessData, config };
  }, [slots, activeVehicles, exitProcessData, config]);

  // Efek Simulasi Otomatis (Demo Mode)
  useEffect(() => {
    if (!config.demo_mode) return;

    const demoInterval = setInterval(() => {
      const {
        slots: currentSlots,
        activeVehicles: currentVehicles,
        exitProcessData: currentExitData,
        config: currentConfig,
      } = stateRef.current;

      // Jangan simulasikan kalau ada kendaraan yg sedang checkout
      if (currentExitData) return;

      const isEntering = Math.random() > 0.4;
      const availableSlots = currentSlots.filter((s) => s.status === "kosong");

      if (isEntering && availableSlots.length > 0) {
        // [SIMULASI] Kendaraan Masuk
        const randomSlot =
          availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const newTicketId = `DEMO-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0")}`;
        const newTime = Date.now();
        const checkInTime =
          newTime - Math.floor(Math.random() * 3 * 3600 * 1000);

        syncToDB("vehicle_in", {
          ticketId: newTicketId,
          slotId: randomSlot.id,
          checkInTime,
          logId: newTime.toString(),
        });
      } else if (!isEntering && currentVehicles.length > 0) {
        // [SIMULASI] Kendaraan Keluar
        const vehicle =
          currentVehicles[Math.floor(Math.random() * currentVehicles.length)];
        const checkoutTime = Date.now();

        const durationMs = checkoutTime - vehicle.checkInTime;
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        const durationString = `${hours} Jam ${mins} Menit`;
        const billableHours = Math.max(1, Math.ceil(durationMinutes / 60));
        const totalCost = billableHours * currentConfig.harga_per_jam;

        // Picu layar checkout
        setPaymentSuccess(false);
        setExitProcessData({
          ticketId: vehicle.ticketId,
          durationString,
          totalCost,
        });

        // Delay sedikit sebelum bayar
        setTimeout(() => {
          setPaymentSuccess(true); // layar hijau

          // Delay hapus data (kendaraan resmi keluar)
          setTimeout(async () => {
            const exitTime = Date.now();
            setExitProcessData(null);
            setPaymentSuccess(false);

            await syncToDB("vehicle_out", {
              ticketId: vehicle.ticketId,
              slotId: vehicle.slotId,
              logId: exitTime.toString(),
              timestamp: exitTime,
            });
          }, 3000);
        }, 2000);
      }
    }, 4500); // Trigger setiap 4.5 detik

    return () => clearInterval(demoInterval);
  }, [config.demo_mode, syncToDB]);

  return (
    <ParkingContext.Provider
      value={{
        config,
        setConfig,
        slots,
        setSlots,
        activeVehicles,
        setActiveVehicles,
        exitProcessData,
        setExitProcessData,
        paymentSuccess,
        setPaymentSuccess,
        logs,
        setLogs,
        isManualClose,
        setIsManualClose,
        isSlowInternet,
        lastSyncTime,
        syncToDB,
      }}
    >
      {children}
    </ParkingContext.Provider>
  );
}

// ==========================================
// 4. Custom Hook (Untuk kemudahan akses)
// ==========================================

/**
 * Hook `useParking` digunakan di dalam komponen-komponen React untuk
 * membaca dan memodifikasi global state secara mudah.
 */
export function useParking() {
  const context = useContext(ParkingContext);
  if (context === undefined) {
    throw new Error("useParking harus digunakan di dalam ParkingProvider");
  }
  return context;
}

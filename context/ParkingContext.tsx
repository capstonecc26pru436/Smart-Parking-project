'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

// ==========================================
// 1. Tipe Data (Types) & Interfaces
// ==========================================

export interface Config {
  harga_per_jam: number;       // Harga parkir per jam (Integer)
  demo_mode: boolean;          // Menandakan apakah sistem dalam mode demo (Boolean)
}

export interface Slot {
  id: string;                  // Contoh: 'A01', 'A02'
  status: 'kosong' | 'terisi'; // Status slot saat ini
  location: string;            // Contoh: 'Blok A'
}

export interface ActiveVehicle {
  ticketId: string;            // Contoh: 'TIX-001'
  slotId: string;              // Contoh: 'A01'
  checkInTime: number;         // Timestamp ketika kendaraan masuk
}

export interface ExitProcessData {
  ticketId: string;
  durationString: string;
  totalCost: number;
}

export interface LogEntry {
  id: string;
  type: 'in' | 'out';
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
  setExitProcessData: React.Dispatch<React.SetStateAction<ExitProcessData | null>>;
  paymentSuccess: boolean;
  setPaymentSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

// ==========================================
// 2. Inisiasi Data Awal (Initial State)
// ==========================================

// Membuat Array berisi 24 slot parkir (12 di Blok A, 12 di Blok B)
const defaultSlots: Slot[] = Array.from({ length: 24 }, (_, i) => {
  const isBlockA = i < 12;
  const block = isBlockA ? 'A' : 'B';
  const num = (i % 12) + 1;
  const id = `${block}${num.toString().padStart(2, '0')}`;
  
  return {
    id,
    status: 'kosong',
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
  const [exitProcessData, setExitProcessData] = useState<ExitProcessData | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // State untuk Log Keluar/Masuk
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Ref untuk menghindari stale closure di dalam setInterval Demo Mode
  const stateRef = useRef({ slots, activeVehicles, exitProcessData, config });
  useEffect(() => {
    stateRef.current = { slots, activeVehicles, exitProcessData, config };
  }, [slots, activeVehicles, exitProcessData, config]);

  // Efek Simulasi Otomatis (Demo Mode)
  useEffect(() => {
    if (!config.demo_mode) return;

    const demoInterval = setInterval(() => {
      const { slots: currentSlots, activeVehicles: currentVehicles, exitProcessData: currentExitData, config: currentConfig } = stateRef.current;
      
      // Jangan simulasikan kalau ada kendaraan yg sedang checkout
      if (currentExitData) return;

      const isEntering = Math.random() > 0.4;
      const availableSlots = currentSlots.filter(s => s.status === 'kosong');

      if (isEntering && availableSlots.length > 0) {
        // [SIMULASI] Kendaraan Masuk
        const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const newTicketId = `DEMO-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const newTime = Date.now();
        setActiveVehicles(prev => [...prev, {
          ticketId: newTicketId,
          slotId: randomSlot.id,
          // Buat agar durasi masuk sudah beberapa jam lalu supaya ada tagihan
          checkInTime: newTime - Math.floor(Math.random() * 3 * 3600 * 1000) 
        }]);
        setSlots(prev => prev.map(s => s.id === randomSlot.id ? { ...s, status: 'terisi' } : s));
        setLogs(prev => [...prev, { id: newTime.toString(), type: 'in', timestamp: newTime }]);
      } else if (!isEntering && currentVehicles.length > 0) {
        // [SIMULASI] Kendaraan Keluar
        const vehicle = currentVehicles[Math.floor(Math.random() * currentVehicles.length)];
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
          totalCost
        });

        // Delay sedikit sebelum bayar
        setTimeout(() => {
          setPaymentSuccess(true); // layar hijau

          // Delay hapus data (kendaraan resmi keluar)
          setTimeout(() => {
            setSlots(prev => prev.map(s => s.id === vehicle.slotId ? { ...s, status: 'kosong' } : s));
            setActiveVehicles(prev => prev.filter(v => v.ticketId !== vehicle.ticketId));
            setExitProcessData(null);
            setPaymentSuccess(false);
            setLogs(prev => [...prev, { id: Date.now().toString(), type: 'out', timestamp: Date.now() }]);
          }, 3000);
        }, 2000);
      }
    }, 4500); // Trigger setiap 4.5 detik

    return () => clearInterval(demoInterval);
  }, [config.demo_mode]);

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
        setLogs
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
    throw new Error('useParking harus digunakan di dalam ParkingProvider');
  }
  return context;
}

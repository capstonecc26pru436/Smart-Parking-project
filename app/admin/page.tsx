'use client';

import React, { useState } from 'react';
import { useParking } from '@/context/ParkingContext';

export default function DashboardPage() {
  // Mengambil state secara global dari Context
  const { 
    config, 
    setConfig,
    slots, 
    activeVehicles, 
    setSlots, 
    setActiveVehicles,
    setExitProcessData,
    setPaymentSuccess,
    logs
  } = useParking();

  // Local state untuk Admin Checkout Modal
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Menghitung jumlah slot yang kosong dan terisi
  const availableSlots = slots.filter((slot) => slot.status === 'kosong').length;
  const occupiedSlots = slots.length - availableSlots;

  // Track activity last 30 mins
  const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
  const recentLogs = logs.filter(log => log.timestamp > thirtyMinsAgo);
  const recentIn = recentLogs.filter(log => log.type === 'in').length;
  const recentOut = recentLogs.filter(log => log.type === 'out').length;

  // Fungsi Simulasi Kendaraan Masuk
  const simulateCheckIn = () => {
    // Cari slot yang masih kosong
    const emptySlotIndex = slots.findIndex((s) => s.status === 'kosong');
    if (emptySlotIndex === -1) {
      alert('Mohon maaf, semua slot sedang penuh!');
      return;
    }

    const slot = slots[emptySlotIndex];
    const newTicketId = `TIX-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // 1. Update State Kendaraan Aktif
    setActiveVehicles((prev) => [
      ...prev,
      {
        ticketId: newTicketId,
        slotId: slot.id,
        checkInTime: Date.now() - Math.floor(Math.random() * 5 * 3600 * 1000), // Randomize check-in time up to 5 hours ago for demo
      },
    ]);

    // 2. Update Status Slot Menjadi "terisi"
    const updatedSlots = [...slots];
    updatedSlots[emptySlotIndex] = { ...slot, status: 'terisi' };
    setSlots(updatedSlots);
  };

  const handleInitiateCheckout = (ticketId: string) => {
    setSelectedVehicle(ticketId);
    
    const vehicle = activeVehicles.find(v => v.ticketId === ticketId);
    if (!vehicle) return;

    const checkoutTime = Date.now();
    const durationMs = checkoutTime - vehicle.checkInTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationString = `${hours} Jam ${mins} Menit`;
    
    // For demo: minimum 1 hour if less than 60 mins
    const billableHours = Math.max(1, Math.ceil(durationMinutes / 60));
    const totalCost = billableHours * config.harga_per_jam;

    // Trigger state untuk Exit Display
    setPaymentSuccess(false);
    setExitProcessData({
      ticketId: vehicle.ticketId,
      durationString,
      totalCost
    });
  };

  const confirmPayment = () => {
    if (!selectedVehicle) return;
    
    // Set success for exit display to show "Pembayaran Berhasil"
    setPaymentSuccess(true);
    
    const vehicle = activeVehicles.find(v => v.ticketId === selectedVehicle);
    
    setTimeout(() => {
      // 1. Release the slot
      if (vehicle) {
        setSlots(prev => prev.map(slot => 
          slot.id === vehicle.slotId ? { ...slot, status: 'kosong' } : slot
        ));
      }
      
      // 2. Remove from active vehicles
      setActiveVehicles(prev => prev.filter(v => v.ticketId !== selectedVehicle));
      
      // 3. Clear exit display
      setExitProcessData(null);
      setPaymentSuccess(false);
      setSelectedVehicle(null);
    }, 4000);
  };

  return (
    <main className="h-screen bg-slate-50 font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      {/* ==================================================== 
          BAGIAN ADMIN (KIRI) - Nuansa Gelap (Deep Blue/Slate)
          ==================================================== */}
      <section className="bg-slate-900 text-white w-full md:w-96 shrink-0 flex flex-col p-6 overflow-y-auto border-r border-slate-800 shadow-xl z-20">
        <h1 className="text-xl font-bold mb-1 tracking-tight">ParkSystem <span className="text-blue-400">Admin</span></h1>
        <p className="text-slate-400 mb-8 text-xs font-semibold uppercase tracking-wider">
          Global Config (Demo: {config.demo_mode ? 'ON' : 'OFF'})
        </p>

        <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700/50">
          <h2 className="text-sm font-bold text-white mb-3">Configuration</h2>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-400">Rate / Hour</span>
            <span className="font-mono text-sm font-bold text-blue-400">Rp {config.harga_per_jam.toLocaleString('id-ID')}</span>
          </div>
          <input 
            type="range" 
            min="1000" 
            max="25000" 
            step="1000" 
            value={config.harga_per_jam} 
            onChange={(e) => setConfig({...config, harga_per_jam: parseInt(e.target.value)})} 
            className="w-full accent-blue-500" 
          />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700/50">
          <h2 className="text-sm font-bold text-white mb-3">Aktivitas 30 Menit Terakhir</h2>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-slate-900 rounded-lg p-3 text-center border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Masuk</p>
              <p className="text-xl font-bold text-emerald-400">{recentIn}</p>
            </div>
            <div className="flex-1 bg-slate-900 rounded-lg p-3 text-center border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Keluar</p>
              <p className="text-xl font-bold text-rose-400">{recentOut}</p>
            </div>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-900/30">
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">Prediksi Jam Depan</p>
            <p className="text-xs text-slate-300">
              Estimasi <strong className="text-white">{recentIn * 2}</strong> kendaraan masuk dan <strong className="text-white">{recentOut * 2}</strong> kendaraan keluar.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 flex-grow border border-slate-700/50 flex flex-col">
          <h2 className="text-sm font-bold text-white mb-4 flex justify-between items-center">
            <span>Active Vehicles</span>
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">{activeVehicles.length}</span>
          </h2>
          {activeVehicles.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 italic">No vehicles currently parked.</p>
          ) : (
            <ul className="space-y-3 overflow-y-auto pr-2">
              {activeVehicles.map((vehicle) => (
                <li key={vehicle.ticketId} className={`bg-slate-900 p-3 rounded-lg border flex flex-col shadow-sm transition-colors ${selectedVehicle === vehicle.ticketId ? 'border-blue-500' : 'border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-200">{vehicle.ticketId}</p>
                    <span className="bg-blue-600 border border-blue-500 text-white px-2 py-1 space-x-1 rounded text-[10px] font-bold font-mono shadow-inner">
                      {vehicle.slotId}
                    </span>
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <p className="text-[10px] text-slate-400">
                      In: {new Date(vehicle.checkInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <button 
                      onClick={() => handleInitiateCheckout(vehicle.ticketId)}
                      disabled={selectedVehicle !== null}
                      className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 active:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Checkout
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>


      {/* ==================================================== 
          BAGIAN USER (KANAN) - Nuansa Terang (Clean/White)
          ==================================================== */}
      <section className="flex-1 bg-slate-50 flex flex-col overflow-y-auto w-full">
        <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 sm:gap-8">
             <div>
               <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">Dashboard Overview</h1>
             </div>
             <div className="hidden sm:block w-px h-8 bg-slate-200"></div>
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full text-xs font-semibold">
               <span className="w-2 h-2 bg-green-500 rounded-full"></span>
               SYSTEM ONLINE
             </div>
          </div>
          <button 
            onClick={simulateCheckIn}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm active:scale-95 whitespace-nowrap"
          >
            + Check-in Vehicle
          </button>
        </header>

        <div className="p-6 sm:p-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">
          
          {/* STATS AREA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Total Capacity</p>
              <p className="text-2xl font-bold text-slate-800">{slots.length} <span className="text-sm text-slate-400 font-normal">Slots</span></p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Occupied</p>
              <p className="text-2xl font-bold text-slate-800">{occupiedSlots}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Available</p>
              <p className="text-2xl font-bold text-slate-800">{availableSlots}</p>
            </div>
          </div>

          {/* GRID AREA */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-slate-800">Parking Map</h3>
                <p className="text-xs text-slate-400 italic">State: slots[{slots.length}]</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-50 border border-slate-200 rounded"></span> EMPTY</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 border border-blue-600 rounded"></span> OCCUPIED</div>
              </div>
            </div>
          
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
              {slots.map((slot) => {
                const isEmpty = slot.status === 'kosong';
                return (
                  <div 
                    key={slot.id} 
                    className={`
                      p-3 rounded-lg flex flex-col items-center justify-center transition-all duration-200
                      ${isEmpty 
                        ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300' 
                        : 'bg-blue-500 border border-blue-600 shadow-sm'
                      }
                    `}
                  >
                    <span className={`text-[10px] font-bold ${isEmpty ? 'text-slate-400' : 'text-blue-100'}`}>
                      {slot.id}
                    </span>
                    <span 
                      className={`text-[9px] uppercase tracking-wider mt-1 ${
                        isEmpty ? 'text-slate-300' : 'text-white opacity-90'
                      }`}
                    >
                      {isEmpty ? 'Empty' : 'Parked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FOOTER INFO */}
          <footer className="mt-4 flex justify-center pb-4">
            <p className="text-xs text-slate-400 font-medium">Parking System Architecture: Next.js + Context API + Tailwind CSS</p>
          </footer>

        </div>
      </section>

      {/* ADMIN CHECKOUT OVERLAY */}
      {selectedVehicle && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-200">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Proses Pembayaran</h3>
              <p className="text-sm text-slate-500">Tiket: {selectedVehicle}</p>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Status Layar Pelanggan</p>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <span className="text-sm font-medium text-blue-600">Menampilkan tagihan di /exit-display</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setSelectedVehicle(null);
                  setExitProcessData(null);
                  setPaymentSuccess(false);
                }}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmPayment}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
              >
                Konfirmasi Bayar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

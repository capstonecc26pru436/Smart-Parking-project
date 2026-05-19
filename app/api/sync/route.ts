export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { sql, setupDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

let isSetup = false;

export async function GET() {
  try {
    if (!isSetup) {
      await setupDatabase();
      isSetup = true;
    }

    const config = await sql`SELECT * FROM config LIMIT 1`;
    let slots = await prisma.slots.findMany({ orderBy: { id: 'asc' }});
    
    // Seed initial slots manually if empty 
    if (slots.length === 0) {
       const initialSlots = [];
       for (let floor = 1; floor <= 3; floor++) {
          for (let num = 1; num <= 8; num++) {
             const id = `F${floor}-${num.toString().padStart(2, '0')}`;
             initialSlots.push({
                id: id,
                nama_slot: `Lantai ${floor} - Slot ${num}`,
                status: 'kosong'
             });
          }
       }
       await prisma.slots.createMany({ data: initialSlots });
       slots = await prisma.slots.findMany({ orderBy: { id: 'asc' }});
    }
    
    const activeVehicles = await sql`SELECT * FROM active_vehicles`;
    const logs = await sql`SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50`;

    // format data to match context
    const formattedConfig = config[0]
      ? {
          harga_per_jam: config[0].harga_per_jam,
          demo_mode: config[0].demo_mode,
        }
      : { harga_per_jam: 5000, demo_mode: false };

    const formattedSlots = slots.map((s: any) => ({
      id: s.id,
      status: s.status,
      location: `Blok ${s.id.startsWith("A") || s.id.startsWith("F1") ? "A" : "B"}`,
    }));

    const formattedActiveVehicles = activeVehicles.map((v: any) => ({
      ticketId: v.ticket_id,
      slotId: v.slot_id,
      checkInTime: Number(v.check_in_time),
    }));

    const formattedLogs = logs.map((l: any) => ({
      id: l.id,
      type: l.type,
      timestamp: Number(l.timestamp),
    }));

    return NextResponse.json({
      config: formattedConfig,
      slots: formattedSlots,
      activeVehicles: formattedActiveVehicles,
      logs: formattedLogs,
    });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === "update_config") {
      await sql`UPDATE config SET harga_per_jam = ${payload.harga_per_jam}, demo_mode = ${payload.demo_mode}`;
    } else if (action === "vehicle_in") {
      const { ticketId, slotId, checkInTime, logId } = payload;
      
      // Update Prisma slot
      await prisma.slots.update({
        where: { id: slotId },
        data: { status: 'terisi' }
      });
      // Insert Prisma ticket
      await prisma.tickets.create({
        data: {
          id_tiket: ticketId,
          id_slot: slotId,
          waktu_masuk: new Date(checkInTime)
        }
      });
      
      // Keep legacy SQL sync logic for completeness
      await sql`UPDATE slots SET status = 'terisi' WHERE id = ${slotId}`;
      await sql`INSERT INTO active_vehicles (ticket_id, slot_id, check_in_time) VALUES (${ticketId}, ${slotId}, ${checkInTime})`;
      await sql`INSERT INTO logs (id, type, timestamp) VALUES (${logId}, 'in', ${checkInTime})`;
    } else if (action === "vehicle_out") {
      const { ticketId, slotId, logId, timestamp } = payload;
      
      // Update Prisma slot
      await prisma.slots.update({
        where: { id: slotId },
        data: { status: 'kosong' }
      });
      // Update Prisma ticket
      await prisma.tickets.updateMany({
        where: { id_tiket: ticketId },
        data: {
          waktu_keluar: new Date(timestamp),
          total_bayar: 5000 // mock price for now
        }
      });

      // Keep legacy SQL sync logic
      await sql`UPDATE slots SET status = 'kosong' WHERE id = ${slotId}`;
      await sql`DELETE FROM active_vehicles WHERE ticket_id = ${ticketId}`;
      await sql`INSERT INTO logs (id, type, timestamp) VALUES (${logId}, 'out', ${timestamp})`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

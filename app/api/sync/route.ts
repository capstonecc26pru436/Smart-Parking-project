import { NextRequest, NextResponse } from "next/server";
import { sql, setupDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let isSetup = false;
let mockConfig = { harga_per_jam: 5000, demo_mode: false };
let mockSlots: any[] = [];
let mockVehicles: any[] = [];
let mockLogs: any[] = [];

export async function GET() {
  console.log("SYNC GET START");
  try {
    const hasDB = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres") && !process.env.DATABASE_URL.includes("localhost");
    console.log("hasDB =", hasDB);

    if (!isSetup && hasDB) {
      console.log("Setting up DB...");
      await setupDatabase();
      isSetup = true;
      console.log("DB setup done");
    }

    console.log("Fetching config...");
    const config = hasDB ? await sql`SELECT * FROM config LIMIT 1` : [mockConfig];
    console.log("Fetching slots...");
    let slots: any[] = hasDB ? await prisma.slots.findMany({ orderBy: { id: "asc" } }) : mockSlots;

    // Seed initial slots manually if empty
    if (slots.length === 0) {
      console.log("Seeding slots...");
      const initialSlots = [];
      for (let floor = 1; floor <= 3; floor++) {
        for (let num = 1; num <= 8; num++) {
          const id = `F${floor}-${num.toString().padStart(2, "0")}`;
          initialSlots.push({
            id: id,
            nama_slot: `Lantai ${floor} - Slot ${num}`,
            status: "kosong",
          });
        }
      }
      
      if (hasDB) {
        await prisma.slots.createMany({ data: initialSlots });
        slots = await prisma.slots.findMany({ orderBy: { id: "asc" } });
      } else {
        slots = initialSlots;
        mockSlots = slots;
      }
    }

    console.log("Fetching active_vehicles...");
    const activeVehicles = hasDB ? await sql`SELECT * FROM active_vehicles` : mockVehicles;
    console.log("Fetching logs...");
    const logs = hasDB ? await sql`SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50` : mockLogs;

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

    console.log("SYNC GET DONE");
    return NextResponse.json({
      config: formattedConfig,
      slots: formattedSlots,
      activeVehicles: formattedActiveVehicles,
      logs: formattedLogs,
    });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasDB = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres") && !process.env.DATABASE_URL.includes("localhost");
    
    const body = await req.json();
    const { action, payload } = body;

    if (!hasDB) {
      // In preview mode without database, update mock variables directly
      if (action === "update_config") {
        mockConfig = { harga_per_jam: payload.harga_per_jam, demo_mode: payload.demo_mode };
      } else if (action === "vehicle_in") {
        const { ticketId, slotId, checkInTime, logId } = payload;
        mockSlots = mockSlots.map(s => s.id === slotId ? { ...s, status: "terisi" } : s);
        mockVehicles.push({ ticket_id: ticketId, slot_id: slotId, check_in_time: checkInTime });
        mockLogs.push({ id: logId, type: 'in', timestamp: checkInTime });
      } else if (action === "vehicle_out") {
        const { ticketId, slotId, logId, timestamp } = payload;
        mockSlots = mockSlots.map(s => s.id === slotId ? { ...s, status: "kosong" } : s);
        mockVehicles = mockVehicles.filter(v => v.ticket_id !== ticketId);
        mockLogs.push({ id: logId, type: 'out', timestamp: timestamp });
      }
      return NextResponse.json({ success: true, message: "Mock success because no DB config" });
    }

    if (action === "update_config") {
      await sql`UPDATE config SET harga_per_jam = ${payload.harga_per_jam}, demo_mode = ${payload.demo_mode}`;
    } else if (action === "vehicle_in") {
      const { ticketId, slotId, checkInTime, logId } = payload;

      // Update Prisma slot
      await prisma.slots.update({
        where: { id: slotId },
        data: { status: "terisi" },
      });
      // Insert Prisma ticket
      await prisma.tickets.create({
        data: {
          id_tiket: ticketId,
          id_slot: slotId,
          waktu_masuk: new Date(checkInTime),
        },
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
        data: { status: "kosong" },
      });
      // Update Prisma ticket
      await prisma.tickets.updateMany({
        where: { id_tiket: ticketId },
        data: {
          waktu_keluar: new Date(timestamp),
          total_bayar: 5000, // mock price for now
        },
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

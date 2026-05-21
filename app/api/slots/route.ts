export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hasDB = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres") && !process.env.DATABASE_URL.includes("localhost");
    
    let slots: any[] = [];
    if (hasDB) {
      slots = await prisma.slots.findMany();
    }

    // Seed initial slots if empty
    if (slots.length === 0) {
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
        await prisma.slots.createMany({
          data: initialSlots,
        });
        slots = await prisma.slots.findMany();
      } else {
        slots = initialSlots;
      }
    }

    return NextResponse.json({ slots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

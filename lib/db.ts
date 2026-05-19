import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

export const sql = neon(process.env.DATABASE_URL);

export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      id SERIAL PRIMARY KEY,
      harga_per_jam INTEGER NOT NULL,
      demo_mode BOOLEAN NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS slots (
      id VARCHAR(10) PRIMARY KEY,
      status VARCHAR(20) NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS active_vehicles (
      ticket_id VARCHAR(50) PRIMARY KEY,
      slot_id VARCHAR(10) NOT NULL,
      check_in_time BIGINT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(50) PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      timestamp BIGINT NOT NULL
    );
  `;

  // Initialize config if empty
  const configRes = await sql`SELECT * FROM config LIMIT 1`;
  if (configRes.length === 0) {
    await sql`INSERT INTO config (harga_per_jam, demo_mode) VALUES (5000, false)`;
  }

  // Initialize slots if empty
  const slotsRes = await sql`SELECT COUNT(*) as count FROM slots`;
  if (slotsRes[0].count === "0") {
    const slots = [];
    for (let floor = 1; floor <= 3; floor++) {
      for (let num = 1; num <= 8; num++) {
        const id = `F${floor}-${num.toString().padStart(2, "0")}`;
        slots.push({ id, status: "kosong" });
      }
    }
    // Bulk insert (batching is better, but since it's just 24 rows, we could do it simply)
    for (const slot of slots) {
      await sql`INSERT INTO slots (id, status) VALUES (${slot.id}, ${slot.status})`;
    }
  }
}

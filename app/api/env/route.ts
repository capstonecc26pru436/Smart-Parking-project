import { NextResponse } from "next/server";
export const runtime = "edge";
export async function GET() {
  return NextResponse.json({ dbUrl: process.env.DATABASE_URL || "undefined" });
}

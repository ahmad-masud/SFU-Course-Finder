import { NextResponse } from "next/server";
import { fetchSfu } from "@/lib/sfuApi";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchSfu();
  if (!result.ok) {
    return NextResponse.json({ error: result.error, url: result.url }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

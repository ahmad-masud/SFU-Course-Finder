import { NextRequest, NextResponse } from "next/server";
import { fetchSfu } from "@/lib/sfuApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || "current"; // default to current
  const result = await fetchSfu([year]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, url: result.url }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

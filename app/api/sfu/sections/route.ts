import { NextRequest, NextResponse } from "next/server";
import { fetchSfu } from "@/lib/sfuApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const term = searchParams.get("term");
  const dept = searchParams.get("dept");
  const number = searchParams.get("number");
  if (!year || !term || !dept || !number) {
    return NextResponse.json({ error: "Missing year, term, dept, or number" }, { status: 400 });
  }
  const result = await fetchSfu([year, term, dept, number]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, url: result.url }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

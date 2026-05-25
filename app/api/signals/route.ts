import { getKv } from "@/lib/kv";
import { NextResponse } from "next/server";

const KEY = "signals:total";

export async function GET() {
  const kv = getKv();
  if (!kv) {
    return NextResponse.json({ count: 0, configured: false });
  }

  const count = (await kv.get<number>(KEY)) ?? 0;
  return NextResponse.json({ count, configured: true });
}

export async function POST() {
  const kv = getKv();
  if (!kv) {
    return NextResponse.json(
      { error: "KV not configured" },
      { status: 503 },
    );
  }

  const count = await kv.incr(KEY);
  return NextResponse.json({ count, configured: true });
}

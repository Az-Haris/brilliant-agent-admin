import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (password === process.env.PASSWORD_SECRET) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}

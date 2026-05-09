import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Recharge from "@/models/Recharge";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { number, amount, method, last4Digit } = await req.json();
    if (!number || !amount || !method || !last4Digit)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const recharge = await Recharge.create({
      number,
      amount,
      method,
      last4Digit,
    });
    return NextResponse.json({ success: true, recharge }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get("admin") === "1";
    const status = searchParams.get("status"); // filter by status

    const query = status ? { status } : {};
    const records = await Recharge.find(query)
      .sort({ createdAt: -1 })
      .limit(isAdmin ? 200 : 10)
      .lean();

    const result = isAdmin
      ? records
      : records.map((r) => ({
          ...r,
          number: r.number.slice(0, 3) + "******" + r.number.slice(-2),
        }));

    return NextResponse.json({ records: result });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

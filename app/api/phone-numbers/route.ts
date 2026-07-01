import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Phonenumber from "@/models/Phonenumber";

const NUMBER_RE = /^8801\d{9}$/;

// GET /api/phone-numbers?date=YYYY-MM-DD   -> numbers for one day
// GET /api/phone-numbers?search=1712       -> numbers containing this substring, any date
// GET /api/phone-numbers?all=true          -> every number, every date (for full export)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const search = searchParams.get("search");
  const all = searchParams.get("all");

  await connectDB();

  if (search) {
    const results = await Phonenumber.find({ number: { $regex: search } })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ results });
  }

  if (all === "true") {
    const results = await Phonenumber.find({})
      .sort({ date: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({ results });
  }

  const targetDate = date || new Date().toISOString().split("T")[0];
  const results = await Phonenumber.find({ date: targetDate })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ results });
}

// POST /api/phone-numbers  { date: "YYYY-MM-DD", numbers: string[] }
// Numbers should already be normalized to 8801XXXXXXXXX by the caller.
// Duplicates (enforced globally via the unique index on `number`) are
// skipped and counted, not treated as a hard error.
export async function POST(req: NextRequest) {
  let body: { date?: string; numbers?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { date, numbers } = body;
  if (!date || !Array.isArray(numbers) || numbers.length === 0) {
    return NextResponse.json(
      { error: "Both 'date' and a non-empty 'numbers' array are required" },
      { status: 400 },
    );
  }

  await connectDB();

  const uniqueIncoming = Array.from(new Set(numbers));
  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const number of uniqueIncoming) {
    if (!NUMBER_RE.test(number)) {
      invalid++;
      continue;
    }
    try {
      await Phonenumber.create({ number, date });
      added++;
    } catch (err: unknown) {
      // Mongo duplicate-key error code, surfaced the same way through Mongoose
      if ((err as { code?: number })?.code === 11000) {
        duplicates++;
      } else {
        console.error("Insert error:", err);
        throw err;
      }
    }
  }

  return NextResponse.json({
    added,
    duplicates,
    invalid,
    totalSubmitted: numbers.length,
  });
}

// DELETE /api/phone-numbers?number=8801xxxxxxxxx             -> delete one number
// DELETE /api/phone-numbers?date=YYYY-MM-DD&clearDate=true   -> delete a whole day
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get("number");
  const date = searchParams.get("date");
  const clearDate = searchParams.get("clearDate");

  await connectDB();

  if (number) {
    const result = await Phonenumber.deleteOne({ number });
    return NextResponse.json({ deleted: result.deletedCount });
  }

  if (date && clearDate === "true") {
    const result = await Phonenumber.deleteMany({ date });
    return NextResponse.json({ deleted: result.deletedCount });
  }

  return NextResponse.json(
    { error: "Provide either 'number', or 'date' with clearDate=true" },
    { status: 400 },
  );
}

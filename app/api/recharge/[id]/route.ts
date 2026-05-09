import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Recharge from "@/models/Recharge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const { status } = await req.json();

    if (!["Pending", "Success", "Rejected"].includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const updated = await Recharge.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!updated)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, recharge: updated });
  } catch (err) {
    console.error("PATCH error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    await Recharge.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

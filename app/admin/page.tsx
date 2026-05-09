import Link from "next/link";
import { generateMockTransactions } from "@/lib/mock-transactions";
import { CheckCircle2, Clock, CircleX, Wallet, ArrowRight } from "lucide-react";

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type TxStatus = "Success" | "Pending" | "Rejected";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "success" | "warning" | "danger" | "brand";
  hint?: string;
}) {
  const tones = {
    success: "bg-green-50 text-green-700 ring-green-200",
    warning: "bg-yellow-50 text-yellow-700 ring-yellow-200",
    danger: "bg-red-50 text-red-700 ring-red-200",
    brand: "bg-blue-50 text-[#1A3955] ring-blue-200",
  };
  return (
    <div className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div
          className={cn(
            "h-9 w-9 rounded-xl grid place-items-center ring-1",
            tones[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-[#1A3955] tracking-tight">
        {value}
      </p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: TxStatus }) {
  const map = {
    Success: "bg-green-100 text-green-700 border-green-200",
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={cn(
        "text-[11px] font-medium px-2 py-0.5 rounded-full border",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const txns = generateMockTransactions(48);
  const success = txns.filter((t) => t.status === "Success");
  const rejected = txns.filter((t) => t.status === "Rejected");
  const pending = txns.filter((t) => t.status === "Pending");
  const totalAmount = success.reduce((s, t) => s + t.amount, 0);
  const recent = txns.slice(0, 6);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#1A3955]">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of recharge activity.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Successful"
          value={String(success.length)}
          icon={CheckCircle2}
          tone="success"
          hint="Approved recharges"
        />
        <StatCard
          label="Rejected"
          value={String(rejected.length)}
          icon={CircleX}
          tone="danger"
          hint="Declined requests"
        />
        <StatCard
          label="Pending"
          value={String(pending.length)}
          icon={Clock}
          tone="warning"
          hint="Awaiting review"
        />
        <StatCard
          label="Total Amount"
          value={`৳${totalAmount.toLocaleString()}`}
          icon={Wallet}
          tone="brand"
          hint="From successful recharges"
        />
      </div>

      <div className="bg-white rounded-2xl overflow-hidden ring-1 ring-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-[#1A3955]">Recent activity</h2>
            <p className="text-xs text-gray-500">Latest 6 requests</p>
          </div>
          <Link
            href="/admin/transactions"
            className="flex items-center gap-1 text-sm text-[#FA7066] hover:text-[#FA7066]/80 font-medium transition"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="divide-y divide-gray-100">
          {recent.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-mono text-[#1A3955] truncate">{t.number}</p>
                <p className="text-xs text-gray-500" suppressHydrationWarning>
                  {t.method} ·{" "}
                  {new Date(t.createdAt)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold text-[#1A3955]">
                  ৳{t.amount}
                </span>
                <StatusPill status={t.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

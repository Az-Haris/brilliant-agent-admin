"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useTransactions, type TxStatus } from "@/lib/hooks/use-transactions";
import {
  CalendarIcon,
  CheckCircle2,
  CircleX,
  Clock,
  Search,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export type TxAction = "approve" | "reject" | "delete";

const STATUS_PILL: Record<TxStatus, string> = {
  Success: "bg-green-100 text-green-700 border-green-200",
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_ICON = {
  Success: CheckCircle2,
  Pending: Clock,
  Rejected: CircleX,
};

function StatusPill({ status }: { status: TxStatus }) {
  const I = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border",
        STATUS_PILL[status],
      )}
    >
      <I className="h-3 w-3" /> {status}
    </span>
  );
}

const VIEW_COUNTS = [10, 25, 50, 100];

const ACCENT_DOT: Record<"success" | "warning" | "danger", string> = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

interface TxListPageProps {
  title: string;
  subtitle?: string;
  status: TxStatus;
  actions: TxAction[];
  accent: "success" | "warning" | "danger";
}

function DateRangePicker({
  value,
  onChange,
}: {
  value: { from?: Date; to?: Date };
  onChange: (r: { from?: Date; to?: Date }) => void;
}) {
  const [viewing, setViewing] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const firstDay = new Date(viewing.year, viewing.month, 1).getDay();
  const daysInMonth = new Date(viewing.year, viewing.month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(viewing.year, viewing.month, i + 1),
    ),
  ];

  const inRange = (d: Date) => {
    if (!value.from || !value.to) return false;
    return d >= value.from && d <= value.to;
  };
  const isFrom = (d: Date) => value.from?.toDateString() === d.toDateString();
  const isTo = (d: Date) => value.to?.toDateString() === d.toDateString();

  const handleClick = (d: Date) => {
    if (!value.from || (value.from && value.to)) {
      onChange({ from: d, to: undefined });
    } else {
      if (d < value.from) onChange({ from: d, to: value.from });
      else onChange({ from: value.from, to: d });
    }
  };

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="p-3 w-64">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() =>
            setViewing((v) => {
              const m = v.month === 0 ? 11 : v.month - 1;
              const y = v.month === 0 ? v.year - 1 : v.year;
              return { year: y, month: m };
            })
          }
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-[#1A3955]">
          {MONTHS[viewing.month]} {viewing.year}
        </span>
        <button
          onClick={() =>
            setViewing((v) => {
              const m = v.month === 11 ? 0 : v.month + 1;
              const y = v.month === 11 ? v.year + 1 : v.year;
              return { year: y, month: m };
            })
          }
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] text-gray-400 font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) =>
          d === null ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => handleClick(d)}
              className={cn(
                "h-7 w-full rounded text-xs transition",
                isFrom(d) || isTo(d)
                  ? "bg-[#1A3955] text-white font-semibold"
                  : inRange(d)
                    ? "bg-[#1A3955]/10 text-[#1A3955]"
                    : "hover:bg-gray-100 text-gray-700",
              )}
            >
              {d.getDate()}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function TxListPage({
  title,
  subtitle,
  status,
  actions,
  accent,
}: TxListPageProps) {
  const { data, loading, bulkApprove, bulkReject, bulkRemove } =
    useTransactions(status);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [viewCount, setViewCount] = useState(25);
  const [calOpen, setCalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);

  const filtered = useMemo(() => {
    return data.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.number.includes(q) &&
          !t._id.toLowerCase().includes(q) &&
          !t.last4Digit.includes(q)
        )
          return false;
      }
      const d = new Date(t.createdAt);
      if (dateRange.from) {
        const f = new Date(dateRange.from);
        f.setHours(0, 0, 0, 0);
        if (d < f) return false;
      }
      if (dateRange.to) {
        const tt = new Date(dateRange.to);
        tt.setHours(23, 59, 59, 999);
        if (d > tt) return false;
      }
      return true;
    });
  }, [data, search, dateRange]);

  const visible = filtered.slice(0, viewCount);
  const allChecked =
    visible.length > 0 && visible.every((t) => selected.has(t._id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) visible.forEach((t) => next.delete(t._id));
    else visible.forEach((t) => next.add(t._id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedIds = Array.from(selected);

  const onApprove = async (ids: string[]) => {
    await bulkApprove(ids);
    setSelected(new Set());
  };
  const onReject = async (ids: string[]) => {
    await bulkReject(ids);
    setSelected(new Set());
  };
  const onDelete = async (ids: string[]) => {
    await bulkRemove(ids);
    setSelected(new Set());
    setDeleteConfirm(null);
  };

  const hasFilters = !!search || !!dateRange.from;
  const dateLabel = dateRange.from
    ? dateRange.to
      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
      : format(dateRange.from, "MMM d, y")
    : "Date range";

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2.5 w-2.5 rounded-full", ACCENT_DOT[accent])}
          />
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1A3955]">
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Showing {visible.length} of {filtered.length}
          {filtered.length !== data.length
            ? ` (filtered from ${data.length})`
            : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, ID, last 4..."
            className="w-full pl-9 pr-9 h-10 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#1A3955] focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 text-gray-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setCalOpen((v) => !v)}
              className={cn(
                "h-10 px-3 rounded-xl border text-sm flex items-center gap-2 transition whitespace-nowrap",
                dateRange.from
                  ? "border-[#1A3955] text-[#1A3955]"
                  : "border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {dateLabel}
              {dateRange.from && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateRange({});
                  }}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
            {calOpen && (
              <div className="absolute top-12 left-0 z-30 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200">
                <DateRangePicker
                  value={dateRange}
                  onChange={(r) => {
                    setDateRange(r);
                    if (r.from && r.to) setCalOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          <select
            value={viewCount}
            onChange={(e) => setViewCount(Number(e.target.value))}
            className="h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#1A3955] bg-white"
          >
            {VIEW_COUNTS.map((n) => (
              <option key={n} value={n}>
                Show {n}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setDateRange({});
              }}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-[#1A3955] flex items-center gap-1 transition"
            >
              <X className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-14 lg:top-16 z-20 flex flex-wrap items-center justify-between gap-3 bg-[#1A3955] text-white rounded-2xl px-4 py-3 shadow-lg">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex flex-wrap gap-2">
            {actions.includes("approve") && (
              <button
                onClick={() => onApprove(selectedIds)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
            )}
            {actions.includes("reject") && (
              <button
                onClick={() => onReject(selectedIds)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
              >
                <CircleX className="h-4 w-4" /> Reject
              </button>
            )}
            {actions.includes("delete") && (
              <button
                onClick={() => setDeleteConfirm(selectedIds)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/10 text-sm font-medium transition"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-sm transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="bg-white rounded-2xl overflow-hidden ring-1 ring-gray-200 shadow-sm hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr className="text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded accent-[#1A3955]"
                  />
                </th>
                <th className="px-2 py-3 font-medium">ID</th>
                <th className="px-2 py-3 font-medium">Number</th>
                <th className="px-2 py-3 font-medium">Amount</th>
                <th className="px-2 py-3 font-medium">Method</th>
                <th className="px-2 py-3 font-medium">Last 4</th>
                <th className="px-2 py-3 font-medium">Date</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-2 py-3">
                        <div className="h-4 rounded-full bg-gray-200 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    No transactions
                  </td>
                </tr>
              ) : (
                visible.map((t) => (
                  <tr
                    key={t._id}
                    className={cn(
                      "border-t border-gray-100 hover:bg-gray-50 transition",
                      selected.has(t._id) && "bg-blue-50/40",
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(t._id)}
                        onChange={() => toggleOne(t._id)}
                        className="rounded accent-[#1A3955]"
                      />
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-gray-400">
                      {t._id.slice(-6)}
                    </td>
                    <td className="px-2 py-3 font-mono text-[#1A3955]">
                      {t.number}
                    </td>
                    <td className="px-2 py-3 font-semibold text-[#1A3955]">
                      ৳{t.amount}
                    </td>
                    <td className="px-2 py-3 text-gray-600">{t.method}</td>
                    <td className="px-2 py-3 font-mono text-gray-600">
                      {t.last4Digit}
                    </td>
                    <td
                      className="px-2 py-3 text-gray-400 whitespace-nowrap"
                      suppressHydrationWarning
                    >
                      {format(new Date(t.createdAt), "MMM d, HH:mm")}
                    </td>
                    <td className="px-2 py-3">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {actions.includes("approve") && (
                          <button
                            onClick={() => onApprove([t._id])}
                            title="Approve"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {actions.includes("reject") && (
                          <button
                            onClick={() => onReject([t._id])}
                            title="Reject"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                          >
                            <CircleX className="h-4 w-4" />
                          </button>
                        )}
                        {actions.includes("delete") && (
                          <button
                            onClick={() => setDeleteConfirm([t._id])}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 ring-1 ring-gray-200 space-y-3"
            >
              <div className="h-4 bg-gray-200 rounded-full animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded-full animate-pulse w-1/2" />
              <div className="h-8 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          ))
        ) : (
          <>
            {visible.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-400 px-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="rounded accent-[#1A3955]"
                />
                Select all visible
              </label>
            )}
            {visible.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 ring-1 ring-gray-200">
                No transactions
              </div>
            ) : (
              visible.map((t) => (
                <div
                  key={t._id}
                  className={cn(
                    "bg-white rounded-2xl p-4 ring-1 ring-gray-200 space-y-3",
                    selected.has(t._id) && "ring-[#1A3955] bg-blue-50/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(t._id)}
                        onChange={() => toggleOne(t._id)}
                        className="mt-1 rounded accent-[#1A3955]"
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-[#1A3955] font-medium truncate">
                          {t.number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t._id.slice(-6)} · {t.method} · ****{t.last4Digit}
                        </p>
                        <p
                          className="text-xs text-gray-400 mt-0.5"
                          suppressHydrationWarning
                        >
                          {format(new Date(t.createdAt), "MMM d, yyyy · HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#1A3955]">৳{t.amount}</p>
                      <div className="mt-1">
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "grid gap-2",
                      actions.length === 1
                        ? "grid-cols-1"
                        : actions.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-3",
                    )}
                  >
                    {actions.includes("approve") && (
                      <button
                        onClick={() => onApprove([t._id])}
                        className="flex items-center justify-center gap-1 h-9 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </button>
                    )}
                    {actions.includes("reject") && (
                      <button
                        onClick={() => onReject([t._id])}
                        className="flex items-center justify-center gap-1 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
                      >
                        <CircleX className="h-4 w-4" /> Reject
                      </button>
                    )}
                    {actions.includes("delete") && (
                      <button
                        onClick={() => setDeleteConfirm([t._id])}
                        className="flex items-center justify-center gap-1 h-9 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-medium transition"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-[#1A3955]">
              Delete {deleteConfirm.length} transaction
              {deleteConfirm.length > 1 ? "s" : ""}?
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(deleteConfirm)}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {calOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setCalOpen(false)} />
      )}
    </div>
  );
}

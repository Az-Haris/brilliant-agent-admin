"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  CircleX,
  Menu,
  LogOut,
  Wallet,
  X,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  {
    to: "/transactions",
    label: "Successful",
    icon: CheckCircle2,
    exact: false,
  },
  { to: "/pending", label: "Pending", icon: Clock, exact: false },
  { to: "/rejected", label: "Rejected", icon: CircleX, exact: false },
];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
      <div className="h-9 w-9 rounded-xl bg-[#1A3955] text-white grid place-items-center shadow-sm">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-[#1A3955]">Brilliant Admin</p>
        <p className="text-[11px] text-gray-500">Recharge Console</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.to
          : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-[#1A3955] text-white shadow-sm"
                : "text-[#1A3955]/80 hover:bg-[#1A3955]/10 hover:text-[#1A3955]",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gray-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
        <Brand />
        <NavList />
        <div className="mt-auto p-3 border-t border-gray-200">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A3955] transition"
          >
            <LogOut className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/80 backdrop-blur px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#1A3955] text-white grid place-items-center">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-[#1A3955]">
                Brilliant Admin
              </span>
            </div>
          </div>
          <div className="hidden lg:block text-sm text-gray-500">
            Manage recharge requests in real time
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#1A3955] text-white grid place-items-center text-xs font-semibold">
              A
            </div>
            <span className="hidden sm:inline text-[#1A3955] font-medium text-sm">
              Admin
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

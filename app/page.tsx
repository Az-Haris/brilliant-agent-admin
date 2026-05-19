"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Incorrect password. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-zinc-50 font-sans">
      <main className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Admin Access</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Enter your password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1A3955]/30 focus:border-[#1A3955] transition"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-6 py-2.5 rounded-lg bg-[#1A3955] text-white text-sm font-medium hover:bg-[#1A3955]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking..." : "Go to Dashboard"}
          </button>
        </form>
      </main>
    </div>
  );
}

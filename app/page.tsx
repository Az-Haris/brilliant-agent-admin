import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white sm:items-start">
        <Link
          href="/admin"
          className="px-6 py-3 rounded-lg bg-[#1A3955] text-white text-lg font-medium hover:bg-[#1A3955]/90 transition"
        >
          Go to Dashboard
        </Link>
      </main>
    </div>
  );
}

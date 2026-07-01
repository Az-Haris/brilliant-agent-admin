"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";

type PhoneRecord = {
  _id?: string;
  number: string;
  date: string;
  createdAt?: string;
};

// Tesseract is loaded globally via the CDN <script> tag below, not npm-installed.
declare global {
  interface Window {
    Tesseract: any;
  }
}

const NUMBER_RE = /^8801\d{9}$/;
// Matches +8801xxxxxxxxx, 8801xxxxxxxxx, and 01xxxxxxxxx in one pass.
const EXTRACT_RE = /(?:\+?880)?1\d{9}/g;

function normalize(raw: string): string | null {
  let clean = raw.replace(/^\+/, "");
  if (!clean.startsWith("880")) clean = "880" + clean.replace(/^0/, "");
  return NUMBER_RE.test(clean) ? clean : null;
}

function extractNumbers(text: string): string[] {
  const matches = text.match(EXTRACT_RE);
  if (!matches) return [];
  const out = new Set<string>();
  matches.forEach((m) => {
    const clean = normalize(m);
    if (clean) out.add(clean);
  });
  return Array.from(out);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function toCsv(items: PhoneRecord[], contextDate?: string) {
  let csv = "Name,Phone 1 - Value\n";
  const counters: Record<string, number> = {};
  items.forEach((item) => {
    const key = item.date;
    counters[key] = (counters[key] || 0) + 1;
    const d = new Date(item.date);
    const dateFormatted = `${d.getDate()}/${d.toLocaleString("en-US", {
      month: "short",
    })}/${d.getFullYear().toString().slice(-2)}`;
    csv += `BN ${dateFormatted} ${counters[key]},${item.number}\n`;
  });
  return csv;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PhoneExtractorPage() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState<PhoneRecord[]>([]);
  const [search, setSearch] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [status, setStatus] = useState("Ready");
  const [tesseractReady, setTesseractReady] = useState(false);

  const workerRef = useRef<any>(null);
  const workerInitPromise = useRef<Promise<void> | null>(null);

  const initWorker = useCallback(async () => {
    if (workerInitPromise.current) return workerInitPromise.current;
    workerInitPromise.current = (async () => {
      try {
        if (!window.Tesseract) {
          throw new Error("Tesseract failed to load from CDN");
        }
        const worker = await window.Tesseract.createWorker("eng");
        await worker.setParameters({ tessedit_char_whitelist: "0123456789+" });
        workerRef.current = worker;
        setTesseractReady(true);
      } catch (err) {
        console.error("OCR engine failed to load:", err);
        setStatus("OCR engine failed to load (check console / network)");
      }
    })();
    return workerInitPromise.current;
  }, []);

  const loadDate = useCallback(async (d: string) => {
    const res = await fetch(`/api/phone-numbers?date=${encodeURIComponent(d)}`);
    const data = await res.json();
    setItems(data.results || []);
  }, []);

  useEffect(() => {
    loadDate(date);
  }, [date, loadDate]);

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      loadDate(date);
      return;
    }
    const res = await fetch(
      `/api/phone-numbers?search=${encodeURIComponent(q)}`,
    );
    const data = await res.json();
    setItems(data.results || []);
  }

  async function submitNumbers(numbers: string[], targetDate: string) {
    if (numbers.length === 0) return { added: 0, duplicates: 0, invalid: 0 };
    const res = await fetch("/api/phone-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: targetDate, numbers }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json() as Promise<{
      added: number;
      duplicates: number;
      invalid: number;
    }>;
  }

  async function processFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    await initWorker();
    if (!workerRef.current) return; // initWorker already set the error status

    let foundTotal = 0;
    let addedTotal = 0;

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      if (!file.type.startsWith("image/")) continue;
      setStatus(`Scanning... (${i + 1}/${fileArr.length})`);

      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        const {
          data: { text },
        } = await workerRef.current.recognize(dataUrl);
        const numbers = extractNumbers(text);
        foundTotal += numbers.length;
        if (numbers.length > 0) {
          const result = await submitNumbers(numbers, date);
          addedTotal += result.added;
        }
      } catch (err) {
        console.error("OCR failed on file:", file.name, err);
        setStatus(`Error scanning ${file.name} (see console)`);
        return;
      }
    }

    await loadDate(date);
    if (foundTotal === 0) setStatus("Not Found");
    else if (addedTotal === 0) setStatus("Duplicate");
    else setStatus("Completed");
  }

  async function addManual() {
    setStatus("Scanning...");
    const nums = manualInput
      .split(/[\n,\s]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const normalized = nums.map(normalize).filter((n): n is string => !!n);

    setManualInput("");
    if (normalized.length === 0) {
      setStatus("Not Found");
      return;
    }
    try {
      const result = await submitNumbers(normalized, date);
      await loadDate(date);
      if (result.added === 0) setStatus("Duplicate");
      else setStatus("Completed");
    } catch (err) {
      console.error(err);
      setStatus("Error saving numbers (see console)");
    }
  }

  async function delNumber(number: string) {
    await fetch(`/api/phone-numbers?number=${encodeURIComponent(number)}`, {
      method: "DELETE",
    });
    setItems((prev) => prev.filter((x) => x.number !== number));
  }

  async function clearDate() {
    if (!confirm(`Delete all numbers saved for ${date}?`)) return;
    await fetch(
      `/api/phone-numbers?date=${encodeURIComponent(date)}&clearDate=true`,
      { method: "DELETE" },
    );
    setItems([]);
  }

  async function downloadToday() {
    const res = await fetch(`/api/phone-numbers?date=${todayStr()}`);
    const data = await res.json();
    downloadCsv(toCsv(data.results || []), `${todayStr()}_Numbers.csv`);
  }

  function downloadByDate() {
    downloadCsv(toCsv(items), `${date}_Numbers.csv`);
  }

  async function exportAll() {
    const res = await fetch(`/api/phone-numbers?all=true`);
    const data = await res.json();
    downloadCsv(toCsv(data.results || []), "All_Numbers.csv");
  }

  // Paste / drag-drop image support, same as the original static page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) processFiles(files);
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
    }
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
        strategy="afterInteractive"
        onLoad={() => initWorker()}
      />

      <div className="min-h-screen bg-slate-900 text-white text-center px-5 py-6">
        <h2 className="text-xl font-bold mb-4">BD Phone Extractor PRO MAX</h2>

        <label
          htmlFor="fileInput"
          className="block w-full max-w-2xl min-h-[180px] mx-auto border-2 border-dashed border-sky-400 rounded-xl flex items-center justify-center cursor-pointer transition hover:shadow-[0_0_20px_#38bdf8] hover:border-white"
        >
          Drop / Paste or Click to Select Image
        </label>
        <input
          id="fileInput"
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <input
            className="rounded-lg px-3 py-2 text-black"
            placeholder="Enter number (01... / 8801...)"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
          />
          <button
            className="rounded-lg px-4 py-2 bg-sky-400 font-bold"
            onClick={addManual}
          >
            Add Number
          </button>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <input
            className="rounded-lg px-3 py-2 text-black"
            placeholder="Search number"
            value={search}
            onChange={(e) => runSearch(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg px-3 py-2 text-black"
            value={date}
            onChange={(e) => {
              setSearch("");
              setDate(e.target.value);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            Select
          </button>
          <button
            className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
            onClick={downloadToday}
          >
            Today CSV
          </button>
          <button
            className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
            onClick={downloadByDate}
          >
            Download By Date
          </button>
          <button
            className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
            onClick={exportAll}
          >
            Export All
          </button>
          <button
            className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
            onClick={clearDate}
          >
            Clear Date
          </button>
        </div>

        <div className="mt-4 font-bold text-yellow-300">
          {tesseractReady ? status : "Loading OCR engine..."}
        </div>
        <div className="mt-1 font-bold text-emerald-400">
          Total Unique Numbers: {items.length}
        </div>

        <textarea
          readOnly
          className="w-full max-w-2xl h-48 mt-3 bg-slate-950 text-emerald-400 rounded-lg p-2"
          value={items.map((i) => i.number).join("\n")}
        />

        <div className="max-w-2xl mx-auto mt-3 text-left bg-slate-950 rounded-lg p-3">
          {items.map((item) => (
            <div
              key={item.number}
              className="flex justify-between py-1.5 border-b border-slate-700"
            >
              <span>{item.number}</span>
              <button
                className="text-red-400 font-bold px-2"
                onClick={() => delNumber(item.number)}
              >
                X
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

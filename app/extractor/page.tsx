// "use client";

// import { useEffect, useRef, useState, useCallback } from "react";
// import Script from "next/script";

// type PhoneRecord = {
//   _id?: string;
//   number: string;
//   date: string;
//   createdAt?: string;
// };

// // Tesseract is loaded globally via the CDN <script> tag below, not npm-installed.
// declare global {
//   interface Window {
//     Tesseract: any;
//   }
// }

// const NUMBER_RE = /^8801\d{9}$/;
// // Matches +8801xxxxxxxxx, 8801xxxxxxxxx, and 01xxxxxxxxx in one pass.
// const EXTRACT_RE = /(?:\+?880)?1\d{9}/g;

// function normalize(raw: string): string | null {
//   let clean = raw.replace(/^\+/, "");
//   if (!clean.startsWith("880")) clean = "880" + clean.replace(/^0/, "");
//   return NUMBER_RE.test(clean) ? clean : null;
// }

// function extractNumbers(text: string): string[] {
//   const matches = text.match(EXTRACT_RE);
//   if (!matches) return [];
//   const out = new Set<string>();
//   matches.forEach((m) => {
//     const clean = normalize(m);
//     if (clean) out.add(clean);
//   });
//   return Array.from(out);
// }

// function todayStr() {
//   return new Date().toISOString().split("T")[0];
// }

// function toCsv(items: PhoneRecord[], contextDate?: string) {
//   let csv = "Name,Phone 1 - Value\n";
//   const counters: Record<string, number> = {};
//   items.forEach((item) => {
//     const key = item.date;
//     counters[key] = (counters[key] || 0) + 1;
//     const d = new Date(item.date);
//     const dateFormatted = `${d.getDate()}/${d.toLocaleString("en-US", {
//       month: "short",
//     })}/${d.getFullYear().toString().slice(-2)}`;
//     csv += `BN ${dateFormatted} ${counters[key]},${item.number}\n`;
//   });
//   return csv;
// }

// function downloadCsv(csv: string, filename: string) {
//   const blob = new Blob([csv], { type: "text/csv" });
//   const a = document.createElement("a");
//   a.href = URL.createObjectURL(blob);
//   a.download = filename;
//   a.click();
//   URL.revokeObjectURL(a.href);
// }

// export default function PhoneExtractorPage() {
//   const [date, setDate] = useState(todayStr());
//   const [items, setItems] = useState<PhoneRecord[]>([]);
//   const [search, setSearch] = useState("");
//   const [manualInput, setManualInput] = useState("");
//   const [status, setStatus] = useState("Ready");
//   const [tesseractReady, setTesseractReady] = useState(false);

//   const workerRef = useRef<any>(null);
//   const workerInitPromise = useRef<Promise<void> | null>(null);

//   const initWorker = useCallback(async () => {
//     if (workerInitPromise.current) return workerInitPromise.current;
//     workerInitPromise.current = (async () => {
//       try {
//         if (!window.Tesseract) {
//           throw new Error("Tesseract failed to load from CDN");
//         }
//         const worker = await window.Tesseract.createWorker("eng");
//         await worker.setParameters({ tessedit_char_whitelist: "0123456789+" });
//         workerRef.current = worker;
//         setTesseractReady(true);
//       } catch (err) {
//         console.error("OCR engine failed to load:", err);
//         setStatus("OCR engine failed to load (check console / network)");
//       }
//     })();
//     return workerInitPromise.current;
//   }, []);

//   const loadDate = useCallback(async (d: string) => {
//     const res = await fetch(`/api/phone-numbers?date=${encodeURIComponent(d)}`);
//     const data = await res.json();
//     setItems(data.results || []);
//   }, []);

//   useEffect(() => {
//     loadDate(date);
//   }, [date, loadDate]);

//   async function runSearch(q: string) {
//     setSearch(q);
//     if (!q.trim()) {
//       loadDate(date);
//       return;
//     }
//     const res = await fetch(
//       `/api/phone-numbers?search=${encodeURIComponent(q)}`,
//     );
//     const data = await res.json();
//     setItems(data.results || []);
//   }

//   async function submitNumbers(numbers: string[], targetDate: string) {
//     if (numbers.length === 0) return { added: 0, duplicates: 0, invalid: 0 };
//     const res = await fetch("/api/phone-numbers", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ date: targetDate, numbers }),
//     });
//     if (!res.ok) {
//       const err = await res.json().catch(() => ({}));
//       throw new Error(err.error || `Request failed (${res.status})`);
//     }
//     return res.json() as Promise<{
//       added: number;
//       duplicates: number;
//       invalid: number;
//     }>;
//   }

//   async function processFiles(files: FileList | File[]) {
//     const fileArr = Array.from(files);
//     if (fileArr.length === 0) return;

//     await initWorker();
//     if (!workerRef.current) return; // initWorker already set the error status

//     let foundTotal = 0;
//     let addedTotal = 0;

//     for (let i = 0; i < fileArr.length; i++) {
//       const file = fileArr[i];
//       if (!file.type.startsWith("image/")) continue;
//       setStatus(`Scanning... (${i + 1}/${fileArr.length})`);

//       const dataUrl: string = await new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload = (e) => resolve(e.target?.result as string);
//         reader.onerror = reject;
//         reader.readAsDataURL(file);
//       });

//       try {
//         const {
//           data: { text },
//         } = await workerRef.current.recognize(dataUrl);
//         const numbers = extractNumbers(text);
//         foundTotal += numbers.length;
//         if (numbers.length > 0) {
//           const result = await submitNumbers(numbers, date);
//           addedTotal += result.added;
//         }
//       } catch (err) {
//         console.error("OCR failed on file:", file.name, err);
//         setStatus(`Error scanning ${file.name} (see console)`);
//         return;
//       }
//     }

//     await loadDate(date);
//     if (foundTotal === 0) setStatus("Not Found");
//     else if (addedTotal === 0) setStatus("Duplicate");
//     else setStatus("Completed");
//   }

//   async function addManual() {
//     setStatus("Scanning...");
//     const nums = manualInput
//       .split(/[\n,\s]+/)
//       .map((n) => n.trim())
//       .filter(Boolean);
//     const normalized = nums.map(normalize).filter((n): n is string => !!n);

//     setManualInput("");
//     if (normalized.length === 0) {
//       setStatus("Not Found");
//       return;
//     }
//     try {
//       const result = await submitNumbers(normalized, date);
//       await loadDate(date);
//       if (result.added === 0) setStatus("Duplicate");
//       else setStatus("Completed");
//     } catch (err) {
//       console.error(err);
//       setStatus("Error saving numbers (see console)");
//     }
//   }

//   async function delNumber(number: string) {
//     await fetch(`/api/phone-numbers?number=${encodeURIComponent(number)}`, {
//       method: "DELETE",
//     });
//     setItems((prev) => prev.filter((x) => x.number !== number));
//   }

//   async function clearDate() {
//     if (!confirm(`Delete all numbers saved for ${date}?`)) return;
//     await fetch(
//       `/api/phone-numbers?date=${encodeURIComponent(date)}&clearDate=true`,
//       { method: "DELETE" },
//     );
//     setItems([]);
//   }

//   async function downloadToday() {
//     const res = await fetch(`/api/phone-numbers?date=${todayStr()}`);
//     const data = await res.json();
//     downloadCsv(toCsv(data.results || []), `${todayStr()}_Numbers.csv`);
//   }

//   function downloadByDate() {
//     downloadCsv(toCsv(items), `${date}_Numbers.csv`);
//   }

//   async function exportAll() {
//     const res = await fetch(`/api/phone-numbers?all=true`);
//     const data = await res.json();
//     downloadCsv(toCsv(data.results || []), "All_Numbers.csv");
//   }

//   // Paste / drag-drop image support, same as the original static page.
//   useEffect(() => {
//     function onPaste(e: ClipboardEvent) {
//       const items = e.clipboardData?.items;
//       if (!items) return;
//       const files: File[] = [];
//       for (let i = 0; i < items.length; i++) {
//         if (items[i].type.startsWith("image/")) {
//           const f = items[i].getAsFile();
//           if (f) files.push(f);
//         }
//       }
//       if (files.length > 0) processFiles(files);
//     }
//     function onDragOver(e: DragEvent) {
//       e.preventDefault();
//     }
//     function onDrop(e: DragEvent) {
//       e.preventDefault();
//       if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
//     }
//     document.addEventListener("paste", onPaste);
//     document.addEventListener("dragover", onDragOver);
//     document.addEventListener("drop", onDrop);
//     return () => {
//       document.removeEventListener("paste", onPaste);
//       document.removeEventListener("dragover", onDragOver);
//       document.removeEventListener("drop", onDrop);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [date]);

//   return (
//     <>
//       <Script
//         src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
//         strategy="afterInteractive"
//         onLoad={() => initWorker()}
//       />

//       <div className="min-h-screen bg-slate-900 text-white text-center px-5 py-6">
//         <h2 className="text-xl font-bold mb-4">BD Phone Extractor PRO MAX</h2>

//         <label
//           htmlFor="fileInput"
//           className="block w-full max-w-2xl min-h-[180px] mx-auto border-2 border-dashed border-sky-400 rounded-xl flex items-center justify-center cursor-pointer transition hover:shadow-[0_0_20px_#38bdf8] hover:border-white"
//         >
//           Drop / Paste or Click to Select Image
//         </label>
//         <input
//           id="fileInput"
//           type="file"
//           multiple
//           hidden
//           onChange={(e) => e.target.files && processFiles(e.target.files)}
//         />

//         <div className="mt-4 flex flex-wrap justify-center gap-2">
//           <input
//             className="rounded-lg px-3 py-2 text-black"
//             placeholder="Enter number (01... / 8801...)"
//             value={manualInput}
//             onChange={(e) => setManualInput(e.target.value)}
//           />
//           <button
//             className="rounded-lg px-4 py-2 bg-sky-400 font-bold"
//             onClick={addManual}
//           >
//             Add Number
//           </button>
//         </div>

//         <div className="mt-3 flex flex-wrap justify-center gap-2">
//           <input
//             className="rounded-lg px-3 py-2 text-black"
//             placeholder="Search number"
//             value={search}
//             onChange={(e) => runSearch(e.target.value)}
//           />
//           <input
//             type="date"
//             className="rounded-lg px-3 py-2 text-black"
//             value={date}
//             onChange={(e) => {
//               setSearch("");
//               setDate(e.target.value);
//             }}
//           />
//         </div>

//         <div className="mt-4 flex flex-wrap justify-center gap-2">
//           <button
//             className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
//             onClick={() => document.getElementById("fileInput")?.click()}
//           >
//             Select
//           </button>
//           <button
//             className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
//             onClick={downloadToday}
//           >
//             Today CSV
//           </button>
//           <button
//             className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
//             onClick={downloadByDate}
//           >
//             Download By Date
//           </button>
//           <button
//             className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
//             onClick={exportAll}
//           >
//             Export All
//           </button>
//           <button
//             className="rounded-lg px-3 py-2 bg-sky-400 font-bold"
//             onClick={clearDate}
//           >
//             Clear Date
//           </button>
//         </div>

//         <div className="mt-4 font-bold text-yellow-300">
//           {tesseractReady ? status : "Loading OCR engine..."}
//         </div>
//         <div className="mt-1 font-bold text-emerald-400">
//           Total Unique Numbers: {items.length}
//         </div>

//         <textarea
//           readOnly
//           className="w-full max-w-2xl h-48 mt-3 bg-slate-950 text-emerald-400 rounded-lg p-2"
//           value={items.map((i) => i.number).join("\n")}
//         />

//         <div className="max-w-2xl mx-auto mt-3 text-left bg-slate-950 rounded-lg p-3">
//           {items.map((item) => (
//             <div
//               key={item.number}
//               className="flex justify-between py-1.5 border-b border-slate-700"
//             >
//               <span>{item.number}</span>
//               <button
//                 className="text-red-400 font-bold px-2"
//                 onClick={() => delNumber(item.number)}
//               >
//                 X
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );
// }

// "use client";

// import { useEffect, useRef, useState, useCallback } from "react";
// import Script from "next/script";
// import {
//   UploadCloud,
//   Search,
//   CalendarDays,
//   Download,
//   FileDown,
//   Trash2,
//   PlusCircle,
//   X,
//   Loader2,
//   CheckCircle2,
//   AlertCircle,
//   Copy,
// } from "lucide-react";

// type PhoneRecord = {
//   _id?: string;
//   number: string;
//   date: string;
//   createdAt?: string;
// };

// // Tesseract is loaded globally via the CDN <script> tag below, not npm-installed.
// declare global {
//   interface Window {
//     Tesseract: any;
//   }
// }

// const NUMBER_RE = /^8801\d{9}$/;
// // Matches +8801xxxxxxxxx, 8801xxxxxxxxx, and 01xxxxxxxxx in one pass.
// const EXTRACT_RE = /(?:\+?880)?1\d{9}/g;

// function normalize(raw: string): string | null {
//   let clean = raw.replace(/^\+/, "");
//   if (!clean.startsWith("880")) clean = "880" + clean.replace(/^0/, "");
//   return NUMBER_RE.test(clean) ? clean : null;
// }

// function extractNumbers(text: string): string[] {
//   const matches = text.match(EXTRACT_RE);
//   if (!matches) return [];
//   const out = new Set<string>();
//   matches.forEach((m) => {
//     const clean = normalize(m);
//     if (clean) out.add(clean);
//   });
//   return Array.from(out);
// }

// function todayStr() {
//   return new Date().toISOString().split("T")[0];
// }

// function toCsv(items: PhoneRecord[], contextDate?: string) {
//   let csv = "Name,Phone 1 - Value\n";
//   const counters: Record<string, number> = {};
//   items.forEach((item) => {
//     const key = item.date;
//     counters[key] = (counters[key] || 0) + 1;
//     const d = new Date(item.date);
//     const dateFormatted = `${d.getDate()}/${d.toLocaleString("en-US", {
//       month: "short",
//     })}/${d.getFullYear().toString().slice(-2)}`;
//     csv += `BN ${dateFormatted} ${counters[key]},${item.number}\n`;
//   });
//   return csv;
// }

// function downloadCsv(csv: string, filename: string) {
//   const blob = new Blob([csv], { type: "text/csv" });
//   const a = document.createElement("a");
//   a.href = URL.createObjectURL(blob);
//   a.download = filename;
//   a.click();
//   URL.revokeObjectURL(a.href);
// }

// // ---- UI-only helpers (no effect on data/logic) ----
// function statusStyle(status: string, tesseractReady: boolean) {
//   if (!tesseractReady) {
//     return {
//       classes: "bg-slate-100 text-slate-500 border-slate-200",
//       icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
//     };
//   }
//   if (status.startsWith("Scanning")) {
//     return {
//       classes: "bg-blue-50 text-blue-700 border-blue-200",
//       icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
//     };
//   }
//   if (status === "Completed") {
//     return {
//       classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
//       icon: <CheckCircle2 className="h-3.5 w-3.5" />,
//     };
//   }
//   if (status === "Duplicate") {
//     return {
//       classes: "bg-amber-50 text-amber-700 border-amber-200",
//       icon: <AlertCircle className="h-3.5 w-3.5" />,
//     };
//   }
//   if (status === "Not Found") {
//     return {
//       classes: "bg-slate-100 text-slate-600 border-slate-200",
//       icon: <AlertCircle className="h-3.5 w-3.5" />,
//     };
//   }
//   if (status.startsWith("Error")) {
//     return {
//       classes: "bg-red-50 text-red-700 border-red-200",
//       icon: <AlertCircle className="h-3.5 w-3.5" />,
//     };
//   }
//   return {
//     classes: "bg-slate-100 text-slate-500 border-slate-200",
//     icon: null,
//   };
// }

// export default function PhoneExtractorPage() {
//   const [date, setDate] = useState(todayStr());
//   const [items, setItems] = useState<PhoneRecord[]>([]);
//   const [search, setSearch] = useState("");
//   const [manualInput, setManualInput] = useState("");
//   const [status, setStatus] = useState("Ready");
//   const [tesseractReady, setTesseractReady] = useState(false);
//   const [isDragging, setIsDragging] = useState(false); // UI-only, visual affordance
//   const [copied, setCopied] = useState(false); // UI-only, "copy list" feedback

//   const workerRef = useRef<any>(null);
//   const workerInitPromise = useRef<Promise<void> | null>(null);

//   const initWorker = useCallback(async () => {
//     if (workerInitPromise.current) return workerInitPromise.current;
//     workerInitPromise.current = (async () => {
//       try {
//         if (!window.Tesseract) {
//           throw new Error("Tesseract failed to load from CDN");
//         }
//         const worker = await window.Tesseract.createWorker("eng");
//         await worker.setParameters({ tessedit_char_whitelist: "0123456789+" });
//         workerRef.current = worker;
//         setTesseractReady(true);
//       } catch (err) {
//         console.error("OCR engine failed to load:", err);
//         setStatus("OCR engine failed to load (check console / network)");
//       }
//     })();
//     return workerInitPromise.current;
//   }, []);

//   const loadDate = useCallback(async (d: string) => {
//     const res = await fetch(`/api/phone-numbers?date=${encodeURIComponent(d)}`);
//     const data = await res.json();
//     setItems(data.results || []);
//   }, []);

//   useEffect(() => {
//     loadDate(date);
//   }, [date, loadDate]);

//   async function runSearch(q: string) {
//     setSearch(q);
//     if (!q.trim()) {
//       loadDate(date);
//       return;
//     }
//     const res = await fetch(
//       `/api/phone-numbers?search=${encodeURIComponent(q)}`,
//     );
//     const data = await res.json();
//     setItems(data.results || []);
//   }

//   async function submitNumbers(numbers: string[], targetDate: string) {
//     if (numbers.length === 0) return { added: 0, duplicates: 0, invalid: 0 };
//     const res = await fetch("/api/phone-numbers", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ date: targetDate, numbers }),
//     });
//     if (!res.ok) {
//       const err = await res.json().catch(() => ({}));
//       throw new Error(err.error || `Request failed (${res.status})`);
//     }
//     return res.json() as Promise<{
//       added: number;
//       duplicates: number;
//       invalid: number;
//     }>;
//   }

//   async function processFiles(files: FileList | File[]) {
//     const fileArr = Array.from(files);
//     if (fileArr.length === 0) return;

//     await initWorker();
//     if (!workerRef.current) return; // initWorker already set the error status

//     let foundTotal = 0;
//     let addedTotal = 0;

//     for (let i = 0; i < fileArr.length; i++) {
//       const file = fileArr[i];
//       if (!file.type.startsWith("image/")) continue;
//       setStatus(`Scanning... (${i + 1}/${fileArr.length})`);

//       const dataUrl: string = await new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload = (e) => resolve(e.target?.result as string);
//         reader.onerror = reject;
//         reader.readAsDataURL(file);
//       });

//       try {
//         const {
//           data: { text },
//         } = await workerRef.current.recognize(dataUrl);
//         const numbers = extractNumbers(text);
//         foundTotal += numbers.length;
//         if (numbers.length > 0) {
//           const result = await submitNumbers(numbers, date);
//           addedTotal += result.added;
//         }
//       } catch (err) {
//         console.error("OCR failed on file:", file.name, err);
//         setStatus(`Error scanning ${file.name} (see console)`);
//         return;
//       }
//     }

//     await loadDate(date);
//     if (foundTotal === 0) setStatus("Not Found");
//     else if (addedTotal === 0) setStatus("Duplicate");
//     else setStatus("Completed");
//   }

//   async function addManual() {
//     setStatus("Scanning...");
//     const nums = manualInput
//       .split(/[\n,\s]+/)
//       .map((n) => n.trim())
//       .filter(Boolean);
//     const normalized = nums.map(normalize).filter((n): n is string => !!n);

//     setManualInput("");
//     if (normalized.length === 0) {
//       setStatus("Not Found");
//       return;
//     }
//     try {
//       const result = await submitNumbers(normalized, date);
//       await loadDate(date);
//       if (result.added === 0) setStatus("Duplicate");
//       else setStatus("Completed");
//     } catch (err) {
//       console.error(err);
//       setStatus("Error saving numbers (see console)");
//     }
//   }

//   async function delNumber(number: string) {
//     await fetch(`/api/phone-numbers?number=${encodeURIComponent(number)}`, {
//       method: "DELETE",
//     });
//     setItems((prev) => prev.filter((x) => x.number !== number));
//   }

//   async function clearDate() {
//     if (!confirm(`Delete all numbers saved for ${date}?`)) return;
//     await fetch(
//       `/api/phone-numbers?date=${encodeURIComponent(date)}&clearDate=true`,
//       { method: "DELETE" },
//     );
//     setItems([]);
//   }

//   async function downloadToday() {
//     const res = await fetch(`/api/phone-numbers?date=${todayStr()}`);
//     const data = await res.json();
//     downloadCsv(toCsv(data.results || []), `${todayStr()}_Numbers.csv`);
//   }

//   function downloadByDate() {
//     downloadCsv(toCsv(items), `${date}_Numbers.csv`);
//   }

//   async function exportAll() {
//     const res = await fetch(`/api/phone-numbers?all=true`);
//     const data = await res.json();
//     downloadCsv(toCsv(data.results || []), "All_Numbers.csv");
//   }

//   function copyList() {
//     // UI-only convenience, does not touch stored data
//     navigator.clipboard.writeText(items.map((i) => i.number).join("\n"));
//     setCopied(true);
//     setTimeout(() => setCopied(false), 1500);
//   }

//   // Paste / drag-drop image support, same as the original static page.
//   useEffect(() => {
//     function onPaste(e: ClipboardEvent) {
//       const items = e.clipboardData?.items;
//       if (!items) return;
//       const files: File[] = [];
//       for (let i = 0; i < items.length; i++) {
//         if (items[i].type.startsWith("image/")) {
//           const f = items[i].getAsFile();
//           if (f) files.push(f);
//         }
//       }
//       if (files.length > 0) processFiles(files);
//     }
//     function onDragOver(e: DragEvent) {
//       e.preventDefault();
//       setIsDragging(true);
//     }
//     function onDragLeave(e: DragEvent) {
//       if (e.target === document || (e as any).relatedTarget === null) {
//         setIsDragging(false);
//       }
//     }
//     function onDrop(e: DragEvent) {
//       e.preventDefault();
//       setIsDragging(false);
//       if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
//     }
//     document.addEventListener("paste", onPaste);
//     document.addEventListener("dragover", onDragOver);
//     document.addEventListener("dragleave", onDragLeave);
//     document.addEventListener("drop", onDrop);
//     return () => {
//       document.removeEventListener("paste", onPaste);
//       document.removeEventListener("dragover", onDragOver);
//       document.removeEventListener("dragleave", onDragLeave);
//       document.removeEventListener("drop", onDrop);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [date]);

//   const badge = statusStyle(status, tesseractReady);

//   return (
//     <>
//       <Script
//         src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
//         strategy="afterInteractive"
//         onLoad={() => initWorker()}
//       />

//       <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
//         <div className="mx-auto max-w-3xl">
//           {/* Header */}
//           <div className="mb-6 text-center">
//             <h1 className="text-2xl font-bold tracking-tight text-slate-900">
//               BD Phone Extractor
//             </h1>
//             <p className="mt-1 text-sm text-slate-500">
//               Pull phone numbers out of screenshots, verify them, and export to
//               CSV.
//             </p>
//           </div>

//           {/* Upload dropzone */}
//           <label
//             htmlFor="fileInput"
//             className={`group flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white px-6 py-8 text-center transition-colors ${
//               isDragging
//                 ? "border-indigo-400 bg-indigo-50"
//                 : "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
//             }`}
//           >
//             <UploadCloud
//               className={`h-8 w-8 transition-colors ${
//                 isDragging
//                   ? "text-indigo-500"
//                   : "text-slate-400 group-hover:text-indigo-400"
//               }`}
//             />
//             <div>
//               <p className="text-sm font-medium text-slate-700">
//                 Drop images, paste, or click to select
//               </p>
//               <p className="mt-0.5 text-xs text-slate-400">
//                 Multiple screenshots supported at once
//               </p>
//             </div>
//           </label>
//           <input
//             id="fileInput"
//             type="file"
//             multiple
//             hidden
//             onChange={(e) => e.target.files && processFiles(e.target.files)}
//           />

//           {/* Toolbar: manual add / search / date */}
//           <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
//             <div className="flex flex-col gap-3 sm:flex-row">
//               <div className="flex flex-1 items-stretch gap-2">
//                 <input
//                   className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
//                   placeholder="Add a number (01... / 8801...)"
//                   value={manualInput}
//                   onChange={(e) => setManualInput(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && addManual()}
//                 />
//                 <button
//                   className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
//                   onClick={addManual}
//                 >
//                   <PlusCircle className="h-4 w-4" />
//                   Add
//                 </button>
//               </div>
//             </div>

//             <div className="mt-3 flex flex-col gap-3 sm:flex-row">
//               <div className="relative flex-1">
//                 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                 <input
//                   className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
//                   placeholder="Search a number"
//                   value={search}
//                   onChange={(e) => runSearch(e.target.value)}
//                 />
//               </div>
//               <div className="relative sm:w-48">
//                 <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                 <input
//                   type="date"
//                   className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
//                   value={date}
//                   onChange={(e) => {
//                     setSearch("");
//                     setDate(e.target.value);
//                   }}
//                 />
//               </div>
//             </div>
//           </div>

//           {/* Action buttons */}
//           <div className="mt-4 flex flex-wrap items-center gap-2">
//             <button
//               className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
//               onClick={() => document.getElementById("fileInput")?.click()}
//             >
//               <UploadCloud className="h-4 w-4" />
//               Select images
//             </button>
//             <button
//               className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
//               onClick={downloadToday}
//             >
//               <Download className="h-4 w-4" />
//               Today's CSV
//             </button>
//             <button
//               className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
//               onClick={downloadByDate}
//             >
//               <FileDown className="h-4 w-4" />
//               Download by date
//             </button>
//             <button
//               className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
//               onClick={exportAll}
//             >
//               <FileDown className="h-4 w-4" />
//               Export all
//             </button>
//             <button
//               className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
//               onClick={clearDate}
//             >
//               <Trash2 className="h-4 w-4" />
//               Clear date
//             </button>
//           </div>

//           {/* Status + count */}
//           <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
//             <span
//               className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badge.classes}`}
//             >
//               {badge.icon}
//               {tesseractReady ? status : "Loading OCR engine..."}
//             </span>
//             <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
//               {items.length} unique number{items.length === 1 ? "" : "s"}
//             </span>
//           </div>

//           {/* Results list */}
//           <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
//             <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
//               <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
//                 Numbers for {date}
//               </span>
//               <button
//                 className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-40"
//                 onClick={copyList}
//                 disabled={items.length === 0}
//               >
//                 <Copy className="h-3.5 w-3.5" />
//                 {copied ? "Copied" : "Copy list"}
//               </button>
//             </div>

//             {items.length === 0 ? (
//               <div className="px-4 py-10 text-center text-sm text-slate-400">
//                 No numbers yet — upload or add one above.
//               </div>
//             ) : (
//               <div className="max-h-80 overflow-y-auto">
//                 {items.map((item) => (
//                   <div
//                     key={item.number}
//                     className="group flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50"
//                   >
//                     <span className="font-mono text-sm text-slate-700">
//                       {item.number}
//                     </span>
//                     <button
//                       className="rounded-md p-1 text-slate-300 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
//                       onClick={() => delNumber(item.number)}
//                       aria-label={`Remove ${item.number}`}
//                     >
//                       <X className="h-4 w-4" />
//                     </button>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createWorker } from "tesseract.js";
import {
  UploadCloud,
  Search,
  CalendarDays,
  Download,
  FileDown,
  Trash2,
  PlusCircle,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";

type PhoneRecord = {
  _id?: string;
  number: string;
  date: string;
  createdAt?: string;
};

// ---- Number validation / extraction ----
// Final stored format is always 8801XXXXXXXXX (13 digits: 880 + 1 + 9 digits).
const NUMBER_RE = /^8801[3-9]\d{8}$/;

// Extraction regex, tightened to avoid false positives from OCR text:
//  - (?<!\d) / (?!\d)  -> the match must be a COMPLETE, isolated digit run.
//    Without this, a pattern like /1\d{9}/ will happily match a 10-digit
//    slice out of the middle of a longer, unrelated number (an order id,
//    a date stamp, two numbers merged by OCR line breaks, etc) and produce
//    a "phone number" that never actually existed in the image.
//  - 1[3-9]  -> BD mobile operator codes are 013/014/015/016/017/018/019.
//    Anything else (010, 011, 012...) is rejected outright instead of being
//    accepted as a maybe-valid number.
// Together these mean: if a number is missing a digit or is OCR-garbled,
// it is simply skipped (never appears) rather than being "completed" by
// grabbing digits from whatever text happens to sit next to it.
const EXTRACT_RE = /(?<!\d)(?:\+?880|0)1[3-9]\d{8}(?!\d)/g;

function normalize(raw: string): string | null {
  let clean = raw.replace(/^\+/, "");
  if (clean.startsWith("880")) {
    // already country-code format, leave as is
  } else if (clean.startsWith("0")) {
    clean = "880" + clean.slice(1);
  } else {
    return null;
  }
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

// ---- UI-only helpers (no effect on data/logic) ----
function statusStyle(status: string, tesseractReady: boolean) {
  if (!tesseractReady) {
    return {
      classes: "bg-slate-100 text-slate-500 border-slate-200",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }
  if (status.startsWith("Scanning")) {
    return {
      classes: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }
  if (status === "Completed") {
    return {
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    };
  }
  if (status === "Duplicate") {
    return {
      classes: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    };
  }
  if (status === "Not Found") {
    return {
      classes: "bg-slate-100 text-slate-600 border-slate-200",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    };
  }
  if (status.startsWith("Error")) {
    return {
      classes: "bg-red-50 text-red-700 border-red-200",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    };
  }
  return {
    classes: "bg-slate-100 text-slate-500 border-slate-200",
    icon: null,
  };
}

export default function PhoneExtractorPage() {
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState<PhoneRecord[]>([]);
  const [search, setSearch] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [status, setStatus] = useState("Ready");
  const [tesseractReady, setTesseractReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // UI-only, visual affordance
  const [copied, setCopied] = useState(false); // UI-only, "copy list" feedback

  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(
    null,
  );
  const workerInitPromise = useRef<Promise<void> | null>(null);

  const initWorker = useCallback(async () => {
    if (workerInitPromise.current) return workerInitPromise.current;
    workerInitPromise.current = (async () => {
      try {
        const worker = await createWorker(["eng", "ben"]);
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

  // Kick off worker init once on mount instead of waiting on a CDN <script> onLoad.
  useEffect(() => {
    initWorker();
    return () => {
      workerRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function copyList() {
    // UI-only convenience, does not touch stored data
    navigator.clipboard.writeText(items.map((i) => i.number).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      setIsDragging(true);
    }
    function onDragLeave(e: DragEvent) {
      if (e.target === document || (e as any).relatedTarget === null) {
        setIsDragging(false);
      }
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
    }
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const badge = statusStyle(status, tesseractReady);

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#1A3955]">
          BD Phone Extractor
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pull phone numbers out of screenshots, verify them, and export to CSV.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Upload dropzone */}
        <label
          htmlFor="fileInput"
          className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white px-6 py-8 text-center transition-colors ${
            isDragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
          }`}
        >
          <UploadCloud
            className={`h-8 w-8 transition-colors ${
              isDragging
                ? "text-indigo-500"
                : "text-slate-400 group-hover:text-indigo-400"
            }`}
          />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Drop images, paste, or click to select
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Multiple screenshots supported at once
            </p>
          </div>
        </label>
        <input
          id="fileInput"
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />

        {/* Toolbar: manual add / search / date */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-center">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-stretch gap-2">
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Add a number (01... / 8801...)"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
              />
              <button
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 cursor-pointer"
                onClick={addManual}
              >
                <PlusCircle className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Search a number"
                value={search}
                onChange={(e) => runSearch(e.target.value)}
              />
            </div>
            <div className="relative sm:w-48">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={date}
                onChange={(e) => {
                  setSearch("");
                  setDate(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <UploadCloud className="h-4 w-4" />
          Select images
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
          onClick={downloadToday}
        >
          <Download className="h-4 w-4" />
          Today&apos;s CSV
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
          onClick={downloadByDate}
        >
          <FileDown className="h-4 w-4" />
          Download by date
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
          onClick={exportAll}
        >
          <FileDown className="h-4 w-4" />
          Export all
        </button>
        <button
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 cursor-pointer"
          onClick={clearDate}
        >
          <Trash2 className="h-4 w-4" />
          Clear date
        </button>
      </div>

      {/* Status + count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badge.classes}`}
        >
          {badge.icon}
          {tesseractReady ? status : "Loading OCR engine..."}
        </span>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          {items.length} unique number{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Results list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Numbers for {date}
          </span>
          <button
            className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-40"
            onClick={copyList}
            disabled={items.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy list"}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            No numbers yet — upload or add one above.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.number}
                className="group flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50"
              >
                <span className="font-mono text-sm text-slate-700">
                  {item.number}
                </span>
                <button
                  className="rounded-md p-1 text-slate-300 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                  onClick={() => delNumber(item.number)}
                  aria-label={`Remove ${item.number}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

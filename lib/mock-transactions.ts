export type TxStatus = "Pending" | "Success" | "Rejected";
export type Method = "bKash" | "Nagad" | "Rocket";

export interface Transaction {
  id: string;
  number: string;
  amount: number;
  method: Method;
  last4: string;
  status: TxStatus;
  createdAt: string; // ISO
}

const methods: Method[] = ["bKash", "Nagad", "Rocket"];
const statuses: TxStatus[] = [
  "Success",
  "Pending",
  "Rejected",
  "Success",
  "Success",
  "Pending",
];

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateMockTransactions(count = 48): Transaction[] {
  const now = Date.now();
  return Array.from({ length: count }).map((_, i) => {
    const r = rand(i + 1);
    const amount = [20, 50, 100, 200, 300, 500, 1000][
      Math.floor(rand(i + 7) * 7)
    ];
    const status = statuses[Math.floor(rand(i + 3) * statuses.length)];
    const method = methods[Math.floor(rand(i + 5) * 3)];
    const number =
      "01" + (700000000 + Math.floor(r * 99999999)).toString().slice(0, 9);
    const last4 = String(Math.floor(rand(i + 11) * 9000) + 1000);
    const createdAt = new Date(
      now - i * 1000 * 60 * 60 * (1 + rand(i) * 8),
    ).toISOString();
    return {
      id: `TX-${10000 + i}`,
      number,
      amount,
      method,
      last4,
      status,
      createdAt,
    };
  });
}

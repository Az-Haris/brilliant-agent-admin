"use client";

import { useEffect, useState, useCallback } from "react";

export type TxStatus = "Pending" | "Success" | "Rejected";
export type Method = "bKash" | "Nagad" | "Rocket";

export interface Transaction {
  _id: string;
  number: string;
  amount: number;
  method: Method;
  last4Digit: string;
  status: TxStatus;
  createdAt: string;
}

export function useTransactions(status: TxStatus) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recharge?admin=1&status=${status}`);
      const json = await res.json();
      setData(json.records ?? []);
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const approve = async (id: string) => {
    await fetch(`/api/recharge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Success" }),
    });
    setData((prev) => prev.filter((t) => t._id !== id));
  };

  const reject = async (id: string) => {
    await fetch(`/api/recharge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Rejected" }),
    });
    setData((prev) => prev.filter((t) => t._id !== id));
  };

  const remove = async (id: string) => {
    await fetch(`/api/recharge/${id}`, { method: "DELETE" });
    setData((prev) => prev.filter((t) => t._id !== id));
  };

  const bulkApprove = async (ids: string[]) => {
    await Promise.all(ids.map((id) => approve(id)));
  };

  const bulkReject = async (ids: string[]) => {
    await Promise.all(ids.map((id) => reject(id)));
  };

  const bulkRemove = async (ids: string[]) => {
    await Promise.all(ids.map((id) => remove(id)));
  };

  return {
    data,
    loading,
    error,
    approve,
    reject,
    remove,
    bulkApprove,
    bulkReject,
    bulkRemove,
    refetch: fetchData,
  };
}

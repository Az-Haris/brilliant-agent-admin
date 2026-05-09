import { TxListPage } from "@/components/admin/tx-list-page";

export default function PendingPage() {
  return (
    <TxListPage
      title="Pending Transactions"
      subtitle="Awaiting your review"
      status="Pending"
      actions={["approve", "reject"]}
      accent="warning"
    />
  );
}

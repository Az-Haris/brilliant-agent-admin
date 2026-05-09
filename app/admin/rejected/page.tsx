import { TxListPage } from "@/components/admin/tx-list-page";

export default function RejectedPage() {
  return (
    <TxListPage
      title="Rejected Transactions"
      subtitle="Declined recharge requests"
      status="Rejected"
      actions={["approve", "delete"]}
      accent="danger"
    />
  );
}

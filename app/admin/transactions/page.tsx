import { TxListPage } from "@/components/admin/tx-list-page";

export default function TransactionsPage() {
  return (
    <TxListPage
      title="Successful Transactions"
      subtitle="Approved recharge requests"
      status="Success"
      actions={["delete"]}
      accent="success"
    />
  );
}

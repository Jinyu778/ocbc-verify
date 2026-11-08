import { useQuery } from "@tanstack/react-query";
import { Skeleton, api } from "@safebank/ui";

interface Row {
  id: number;
  staff: string;
  transfer_id: number | null;
  action: string;
  note: string;
  created_at: string;
}

export function Audit() {
  const q = useQuery({ queryKey: ["audit"], queryFn: () => api<Row[]>("/api/staff/audit") });
  return (
    <div className="space-y-4">
      <h1>Audit trail</h1>
      <p className="text-muted-foreground">Every staff action with its note (last 72 hours).</p>
      {q.isLoading ? <Skeleton className="h-32" /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-left">
              <tr>{["Time", "Staff", "Case", "Action", "Note"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data?.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No staff actions yet.</td></tr>}
              {q.data?.map((r) => (
                <tr key={r.id}>
                  <td className="tabular px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.staff}</td>
                  <td className="px-3 py-2">{r.transfer_id ? `SB-${String(r.transfer_id).padStart(6, "0")}` : "–"}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

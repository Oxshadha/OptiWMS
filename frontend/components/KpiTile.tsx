type Props = {
  label: string;
  value: string;
  delta?: string;
  tone?: "success" | "warning" | "error" | "info";
};

const toneMap: Record<NonNullable<Props["tone"]>, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

export function KpiTile({ label, value, delta, tone = "info" }: Props) {
  return (
    <div className="card-surface p-4 space-y-2">
      <div className="text-sm text-base-content/70">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {delta && <div className={`text-sm font-medium ${toneMap[tone]}`}>{delta}</div>}
    </div>
  );
}



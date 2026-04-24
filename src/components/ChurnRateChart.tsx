import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import type { ChurnRateRow } from "@/lib/churn-breakdown";

const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  color: "#111827",
  boxShadow: "0 4px 12px -4px rgba(17,24,39,0.08)",
};

interface Props {
  data: ChurnRateRow[];
  height?: number;
}

export function ChurnRateChart({ data, height = 320 }: Props) {
  const avg = data.length === 0
    ? 0
    : Math.round((data.reduce((s, r) => s + r.rate, 0) / data.length) * 10) / 10;

  const maxRate = Math.max(...data.map((r) => r.rate), avg, 1);
  const yMax = Math.ceil(maxRate * 1.25);

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
          <YAxis
            stroke="#6B7280"
            fontSize={12}
            domain={[0, yMax]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value, _name, props) => {
              const row = props.payload as ChurnRateRow;
              return [`${value}% (${row.exits}/${row.activeStart})`, "Churn"];
            }}
          />
          <ReferenceLine
            y={avg}
            stroke="#6B7280"
            strokeDasharray="5 5"
            label={{
              value: `Média: ${avg}%`,
              position: "right",
              fill: "#6B7280",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ fill: "#EF4444", r: 4 }}
            activeDot={{ r: 6 }}
          >
            <LabelList
              dataKey="rate"
              position="top"
              fontSize={11}
              fill="#111827"
              formatter={(v) => `${v}%`}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

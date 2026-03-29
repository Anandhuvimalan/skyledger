"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface RevenueChartPoint {
  name: string
  recognized: number
  deferred: number
}

const fallbackData: RevenueChartPoint[] = [
  { name: "Jan", recognized: 4500, deferred: 2400 },
  { name: "Feb", recognized: 5200, deferred: 1398 },
  { name: "Mar", recognized: 6100, deferred: 9800 },
  { name: "Apr", recognized: 4780, deferred: 3908 },
  { name: "May", recognized: 5890, deferred: 4800 },
  { name: "Jun", recognized: 8390, deferred: 3800 },
  { name: "Jul", recognized: 9490, deferred: 4300 },
]

export function RevenueChart({ data = fallbackData }: { data?: RevenueChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorRecognized" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorDeferred" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
        <XAxis 
          dataKey="name" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          dy={10}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(value) => `$${value}`}
          dx={-10}
        />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
        />
        <Area
          type="monotone"
          dataKey="deferred"
          stackId="1"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#colorDeferred)"
          name="Deferred Revenue"
        />
        <Area
          type="monotone"
          dataKey="recognized"
          stackId="1"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#colorRecognized)"
          name="Recognized Revenue"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

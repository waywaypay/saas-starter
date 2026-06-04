'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getPlatformColor,
  getPlatformLabel,
  formatFollowers,
  formatEngagementRate,
} from '@/lib/socialos/metrics';

interface PerPlatform {
  platform: string;
  followers: number;
  engagementRate: number;
  reach: number;
  wowChange: number;
}

interface TimeSeriesPoint {
  date: string;
  reach: number;
  engagements: number;
  instagram: number;
  tiktok: number;
  linkedin: number;
  facebook: number;
  youtube: number;
}

interface OverviewData {
  totalReach: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  followerTotal: number;
  followerGrowthPct: number;
  reachChangePct: number;
  engagementsChangePct: number;
  engRateChangePct: number;
  perPlatform: PerPlatform[];
  timeSeries: TimeSeriesPoint[];
}

function Delta({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
      {isPositive ? '▲' : '▼'}{' '}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function SocialOSDashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/socialos/overview?workspaceId=acme-brand&days=${days}`)
      .then((r) => r.json())
      .then((json: OverviewData) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  const dayOptions: Array<{ label: string; value: 7 | 30 | 90 }> = [
    { label: '7D', value: 7 },
    { label: '30D', value: 30 },
    { label: '90D', value: 90 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="flex items-center gap-1">
          {dayOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={days === opt.value ? 'default' : 'outline'}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex flex-wrap gap-4">
        {loading ? (
          <>
            <Skeleton className="h-32 flex-1 min-w-[180px]" />
            <Skeleton className="h-32 flex-1 min-w-[180px]" />
            <Skeleton className="h-32 flex-1 min-w-[180px]" />
            <Skeleton className="h-32 flex-1 min-w-[180px]" />
          </>
        ) : data ? (
          <>
            <Card className="flex-1 min-w-[180px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Reach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totalReach.toLocaleString()}
                </div>
                <div className="text-xs mt-1">
                  <Delta value={data.reachChangePct} />
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-[180px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Engagements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totalEngagements.toLocaleString()}
                </div>
                <div className="text-xs mt-1">
                  <Delta value={data.engagementsChangePct} />
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-[180px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Engagement Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data.avgEngagementRate * 100).toFixed(1)}%
                </div>
                <div className="text-xs mt-1">
                  <Delta value={data.engRateChangePct} />
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-[180px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Follower Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.followerGrowthPct > 0 ? '+' : ''}
                  {Number(
                    ((data.followerGrowthPct / 100) * data.followerTotal).toFixed(0)
                  ).toLocaleString()}
                </div>
                <div className="text-xs mt-1">
                  <Delta value={data.followerGrowthPct} />
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Reach chart */}
      <Card>
        <CardHeader>
          <CardTitle>Reach Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : data ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  interval={days === 90 ? 6 : days === 30 ? 2 : 0}
                />
                <YAxis tickFormatter={(v: number) => v.toLocaleString()} />
                <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
                <Legend />
                {(
                  ['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube'] as const
                ).map((platform) => (
                  <Line
                    key={platform}
                    type="monotone"
                    dataKey={platform}
                    stroke={getPlatformColor(platform)}
                    dot={false}
                    name={getPlatformLabel(platform)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* Platform health cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Platform Health</h2>
        <div className="flex flex-wrap gap-4">
          {loading ? (
            <>
              <Skeleton className="h-24 flex-1 min-w-[180px]" />
              <Skeleton className="h-24 flex-1 min-w-[180px]" />
              <Skeleton className="h-24 flex-1 min-w-[180px]" />
              <Skeleton className="h-24 flex-1 min-w-[180px]" />
              <Skeleton className="h-24 flex-1 min-w-[180px]" />
            </>
          ) : data ? (
            data.perPlatform.map((p) => (
              <Card
                key={p.platform}
                className="flex-1 min-w-[180px] border-l-4"
                style={{ borderLeftColor: getPlatformColor(p.platform) }}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="font-semibold text-sm mb-2">
                    {getPlatformLabel(p.platform)}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      <span className="font-medium text-foreground">
                        {formatFollowers(p.followers)}
                      </span>{' '}
                      followers
                    </div>
                    <div>
                      Eng.{' '}
                      <span className="font-medium text-foreground">
                        {formatEngagementRate(p.engagementRate)}
                      </span>
                    </div>
                    <div
                      className={
                        p.wowChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {p.wowChange >= 0 ? '▲' : '▼'}{' '}
                      {Math.abs(p.wowChange * 100).toFixed(1)}% WoW
                    </div>
                    <div className="text-muted-foreground text-xs mt-1">
                      Last synced 2h ago
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : null}
        </div>
      </div>
    </div>
  );
}

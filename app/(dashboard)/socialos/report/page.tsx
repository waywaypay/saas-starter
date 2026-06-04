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
import { toast } from 'sonner';
import {
  getPlatformColor,
  getPlatformLabel,
  formatFollowers,
} from '@/lib/socialos/metrics';

interface Post {
  id: string;
  platform: string;
  contentType: string;
  caption: string | null;
  postedAt: string;
  reach: number;
  engagementRate: number;
}

interface ReportData {
  workspace: { name: string; slug: string };
  period: { startDate: string; endDate: string };
  summary: {
    totalReach: number;
    totalEngagements: number;
    avgEngagementRate: number;
    followerGrowth: number;
  };
  platformBreakdown: Array<{
    platform: string;
    followers: number;
    reach: number;
    engagementRate: number;
    wowChange: number;
  }>;
  topPosts: Post[];
  timeSeries: Array<{ date: string; reach: number; engagements: number }>;
}

export default function ReportPage() {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/socialos/report?workspaceId=acme-brand&startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Performance Report</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: report preview */}
        <div className="flex-1 lg:w-2/3">
          {loading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : data ? (
            <div className="bg-white border rounded-lg p-8 space-y-8">
              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold">{data.workspace.name}</h2>
                <p className="text-gray-500">Performance Report</p>
                <p className="text-sm text-gray-400 mt-1">
                  {data.period.startDate} – {data.period.endDate}
                </p>
              </div>

              {/* Summary KPIs - 2x2 grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-4">
                  <p className="text-sm text-gray-500">Total Reach</p>
                  <p className="text-2xl font-bold">
                    {data.summary.totalReach.toLocaleString()}
                  </p>
                </div>
                <div className="border rounded p-4">
                  <p className="text-sm text-gray-500">Total Engagements</p>
                  <p className="text-2xl font-bold">
                    {data.summary.totalEngagements.toLocaleString()}
                  </p>
                </div>
                <div className="border rounded p-4">
                  <p className="text-sm text-gray-500">Avg Engagement Rate</p>
                  <p className="text-2xl font-bold">
                    {(data.summary.avgEngagementRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="border rounded p-4">
                  <p className="text-sm text-gray-500">Follower Growth</p>
                  <p className="text-2xl font-bold">
                    {data.summary.followerGrowth > 0 ? '+' : ''}
                    {data.summary.followerGrowth.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Platform breakdown */}
              <div>
                <h3 className="font-semibold mb-3">Platform Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium">Followers</th>
                      <th className="pb-2 font-medium">Reach</th>
                      <th className="pb-2 font-medium">Eng. Rate</th>
                      <th className="pb-2 font-medium">WoW Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.platformBreakdown.map((p, i) => (
                      <tr
                        key={p.platform}
                        className={`border-b ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <td className="py-2 font-medium">
                          {getPlatformLabel(p.platform)}
                        </td>
                        <td className="py-2">{formatFollowers(p.followers)}</td>
                        <td className="py-2">{p.reach.toLocaleString()}</td>
                        <td className="py-2">
                          {(p.engagementRate * 100).toFixed(1)}%
                        </td>
                        <td
                          className={`py-2 font-medium ${
                            p.wowChange >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {p.wowChange >= 0 ? '+' : ''}
                          {(p.wowChange * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top 5 posts */}
              <div>
                <h3 className="font-semibold mb-3">Top Posts</h3>
                <ol className="space-y-3">
                  {data.topPosts.map((post, i) => (
                    <li
                      key={post.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-medium w-5">
                          {i + 1}.
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor:
                              getPlatformColor(post.platform) + '20',
                            color: getPlatformColor(post.platform),
                          }}
                        >
                          {getPlatformLabel(post.platform)}
                        </span>
                        <span className="text-sm text-gray-700 truncate max-w-[300px]">
                          {post.caption?.slice(0, 60) ?? '—'}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          post.engagementRate > 0.08
                            ? 'bg-green-100 text-green-700'
                            : post.engagementRate > 0.04
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {(post.engagementRate * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: controls */}
        <div className="lg:w-1/3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm"
                />
              </div>
              <Button
                className="w-full"
                onClick={fetchReport}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              <hr />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast('PDF export coming soon')}
              >
                Export PDF
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const link = `https://socialos.app/r/${crypto.randomUUID()}`;
                  navigator.clipboard.writeText(link);
                  toast('Link copied to clipboard');
                }}
              >
                Copy share link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

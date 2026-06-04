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
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  LabelList,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown } from 'lucide-react';
import {
  formatDiscoveryScore,
  formatEngagementRate,
  getPlatformColor,
  getPlatformLabel,
} from '@/lib/socialos/metrics';

interface Post {
  id: string;
  platform: string;
  contentType: string;
  caption: string | null;
  postedAt: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  linkClicks: number;
  engagementRate: number;
  discoveryScore: number;
}

interface FormatBreakdown {
  contentType: string;
  avgDiscoveryScore: number;
  avgEngagementRate: number;
  postCount: number;
  totalPosts: number;
  topPost: Post;
}

interface TimeBucket {
  bucket: string;
  avgDiscoveryScore: number;
  avgEngagementRate: number;
  postCount: number;
}

interface CaptionPattern {
  pattern: string;
  avgDiscoveryScore: number;
  postCount: number;
  liftVsBaseline: number;
}

interface PlatformInsight {
  platform: string;
  avgDiscoveryScore: number;
  bestContentType: string;
  bestTimeWindow: string;
  weeklyVelocityTrend: number;
  weeklyScores: number[];
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  platform: string;
  title: string;
  insight: string;
  action: string;
}

interface DiscoveryData {
  avgDiscoveryScore: number;
  discoveryTrend: number;
  postsAbove1x: number;
  topDiscoveryPlatform: string;
  formatBreakdown: FormatBreakdown[];
  timeBuckets: TimeBucket[];
  captionPatterns: CaptionPattern[];
  platformInsights: PlatformInsight[];
  topDiscoveryPosts: Post[];
  recommendations: Recommendation[];
}

const priorityColors: Record<Recommendation['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function DiscoveryPage() {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [data, setData] = useState<DiscoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [dismissedRecs, setDismissedRecs] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/socialos/discovery?workspaceId=acme-brand&days=${days}`)
      .then((r) => r.json())
      .then((json: DiscoveryData) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  const dayOptions: Array<{ label: string; value: 30 | 60 | 90 }> = [
    { label: '30D', value: 30 },
    { label: '60D', value: 60 },
    { label: '90D', value: 90 },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discovery Intelligence</h1>
        <div className="flex items-center gap-4">
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
          {data && (
            <div className="text-sm text-muted-foreground">
              Avg Discovery Score:{' '}
              <span className="font-semibold text-foreground">
                {formatDiscoveryScore(data.avgDiscoveryScore)}
              </span>{' '}
              <span className={data.discoveryTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.discoveryTrend >= 0 ? '↑' : '↓'}{' '}
                {Math.abs(data.discoveryTrend * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: What is Discovery Score? */}
      <Collapsible open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isInfoOpen ? 'rotate-180' : ''}`}
            />
            <span className="font-semibold">What is Discovery Score?</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-gray-700">
            Discovery Score = Reach ÷ Follower Count at time of posting. A score above 1.0x means
            your content reached more people than follow you — the algorithm distributed it beyond
            your audience. Scores above 1.5x indicate strong algorithmic amplification.
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Section 2: Format Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Which content formats drive discovery?</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : data ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  layout="vertical"
                  data={data.formatBreakdown}
                  margin={{ top: 8, right: 80, left: 16, bottom: 8 }}
                >
                  <YAxis type="category" dataKey="contentType" width={100} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => v.toFixed(2) + 'x'}
                  />
                  <ReferenceLine
                    x={data.avgDiscoveryScore}
                    stroke="#6B7280"
                    strokeDasharray="3 3"
                    label={{ value: 'avg', position: 'top' }}
                  />
                  <Bar dataKey="avgDiscoveryScore">
                    <LabelList
                      dataKey="avgDiscoveryScore"
                      position="right"
                      formatter={(v) => typeof v === 'number' ? v.toFixed(2) + 'x' : String(v)}
                    />
                    {data.formatBreakdown.map((entry) => (
                      <Cell
                        key={entry.contentType}
                        fill={
                          entry.avgDiscoveryScore > data.avgDiscoveryScore
                            ? '#0F6E56'
                            : '#9CA3AF'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Format</th>
                    <th className="pb-2 font-medium">Avg Discovery</th>
                    <th className="pb-2 font-medium">Avg Eng. Rate</th>
                    <th className="pb-2 font-medium"># Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.formatBreakdown.map((f) => (
                    <tr key={f.contentType} className="border-b">
                      <td className="py-2">{f.contentType}</td>
                      <td className="py-2">{f.avgDiscoveryScore.toFixed(2)}x</td>
                      <td className="py-2">{(f.avgEngagementRate * 100).toFixed(1)}%</td>
                      <td className="py-2">{f.postCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Section 3: Best Time Windows */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          When does your content get the most distribution?
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : data ? (
          (() => {
            const scores = data.timeBuckets.map((b) => b.avgDiscoveryScore);
            const minScore = Math.min(...scores);
            const maxScore = Math.max(...scores);
            const range = maxScore - minScore || 1;
            const bestBucket = data.timeBuckets.reduce((best, b) =>
              b.avgDiscoveryScore > best.avgDiscoveryScore ? b : best
            );

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.timeBuckets.map((bucket) => {
                  const intensity = (bucket.avgDiscoveryScore - minScore) / range;
                  const bg = `rgba(15, 110, 86, ${(0.1 + intensity * 0.5).toFixed(2)})`;
                  const isBest = bucket.bucket === bestBucket.bucket;

                  return (
                    <div
                      key={bucket.bucket}
                      className="rounded-lg p-3 flex flex-col gap-1"
                      style={{ backgroundColor: bg }}
                    >
                      <span className="font-bold text-sm">{bucket.bucket}</span>
                      <span className="text-xl font-semibold">
                        {bucket.avgDiscoveryScore.toFixed(2)}x
                      </span>
                      <span className="text-xs text-gray-600">{bucket.postCount} posts</span>
                      {isBest && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium w-fit mt-1">
                          Best window
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()
        ) : null}
      </div>

      {/* Section 4: Caption Patterns */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          What caption patterns improve reach?
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.captionPatterns.map((pattern) => (
              <Card key={pattern.pattern}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{pattern.pattern}</p>
                      <p className="text-lg font-semibold mt-1">
                        {pattern.avgDiscoveryScore.toFixed(2)}x
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pattern.postCount} posts
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        pattern.liftVsBaseline >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pattern.liftVsBaseline >= 0 ? '+' : ''}
                      {(pattern.liftVsBaseline * 100).toFixed(0)}% vs baseline
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Section 5: Platform Insights */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Platform-by-platform breakdown</h2>
        {loading ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-36 flex-1 min-w-[180px]" />
            ))}
          </div>
        ) : data ? (
          <div className="flex flex-wrap gap-4">
            {data.platformInsights.map((p) => (
              <Card
                key={p.platform}
                className="flex-1 min-w-[200px] border-l-4"
                style={{ borderLeftColor: getPlatformColor(p.platform) }}
              >
                <CardContent className="pt-4 pb-4">
                  <p className="font-bold text-sm mb-1">{getPlatformLabel(p.platform)}</p>
                  <p className="text-2xl font-semibold">
                    {p.avgDiscoveryScore.toFixed(2)}x
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Best format: {p.bestContentType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Best time: {p.bestTimeWindow}
                  </p>
                  <div className="mt-2">
                    <LineChart
                      width={120}
                      height={40}
                      data={p.weeklyScores.map((v) => ({ v }))}
                    >
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={getPlatformColor(p.platform)}
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </div>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      p.weeklyVelocityTrend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {p.weeklyVelocityTrend > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(p.weeklyVelocityTrend * 100).toFixed(0)}% this month
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Section 6: Recommendations */}
      <div>
        <h2 className="text-lg font-semibold mb-3">What to do next</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
            {data.recommendations
              .filter((rec) => !dismissedRecs.includes(rec.title))
              .map((rec) => (
                <div
                  key={rec.title}
                  className="flex items-start justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            priorityColors[rec.priority]
                          }`}
                        >
                          {rec.priority}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {rec.platform === 'all'
                            ? 'All platforms'
                            : getPlatformLabel(rec.platform)}
                        </span>
                      </div>
                      <p className="font-semibold text-base">{rec.title}</p>
                      <p className="text-sm text-gray-500">{rec.insight}</p>
                      <p className="text-sm">{rec.action}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDismissedRecs((prev) => [...prev, rec.title])
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
      </div>

      {/* Section 7: Top Discovery Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Highest-reach content</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Discovery Score</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Reach</TableHead>
                  <TableHead>Engagements</TableHead>
                  <TableHead>Eng. Rate</TableHead>
                  <TableHead>Saves</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topDiscoveryPosts.slice(0, 10).map((post) => {
                  const scoreColor =
                    post.discoveryScore > 2.0
                      ? 'bg-green-100 text-green-700'
                      : post.discoveryScore >= 1.0
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-gray-100 text-gray-600';

                  const engagements =
                    post.likes + post.comments + post.shares;

                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor:
                              getPlatformColor(post.platform) + '20',
                            color: getPlatformColor(post.platform),
                          }}
                        >
                          {getPlatformLabel(post.platform)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor}`}
                        >
                          {formatDiscoveryScore(post.discoveryScore)}
                        </span>
                      </TableCell>
                      <TableCell>{post.contentType}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {post.caption?.slice(0, 60) ?? '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(post.postedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{post.reach.toLocaleString()}</TableCell>
                      <TableCell>{engagements.toLocaleString()}</TableCell>
                      <TableCell>
                        {formatEngagementRate(post.engagementRate)}
                      </TableCell>
                      <TableCell>{post.saves.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

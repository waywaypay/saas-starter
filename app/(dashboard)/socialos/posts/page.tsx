'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { getPlatformColor, getPlatformLabel } from '@/lib/socialos/metrics';

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
  impressions: number;
}

interface PostsData {
  posts: Post[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 20;

const PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube'] as const;
const CONTENT_TYPES = ['reel', 'carousel', 'static', 'video', 'story'] as const;

const SORT_OPTIONS = [
  { value: 'postedAt', label: 'Date Posted' },
  { value: 'reach', label: 'Reach' },
  { value: 'engagementRate', label: 'Eng. Rate' },
  { value: 'discoveryScore', label: 'Discovery Score' },
  { value: 'likes', label: 'Likes' },
  { value: 'saves', label: 'Saves' },
];

const CONTENT_TYPE_COLORS: Record<string, string> = {
  reel: '#9333ea',
  carousel: '#2563eb',
  static: '#6b7280',
  video: '#ea580c',
  story: '#db2777',
};

function getContentTypeLabel(ct: string): string {
  return ct.charAt(0).toUpperCase() + ct.slice(1);
}

function formatPostedAt(dateStr: string): string {
  const posted = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }
  return posted.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EngRateBadge({ rate }: { rate: number }) {
  let bgColor: string;
  let textColor: string;
  if (rate > 0.08) {
    bgColor = '#dcfce7';
    textColor = '#166534';
  } else if (rate >= 0.04) {
    bgColor = '#fef3c7';
    textColor = '#92400e';
  } else {
    bgColor = '#fee2e2';
    textColor = '#991b1b';
  }
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {(rate * 100).toFixed(1)}%
    </span>
  );
}

export default function PostsPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('postedAt');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PostsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceId: 'acme-brand',
      sortBy,
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
    });
    if (selectedPlatforms.length > 0) {
      params.set('platform', selectedPlatforms.join(','));
    }
    if (selectedContentTypes.length > 0) {
      params.set('contentType', selectedContentTypes.join(','));
    }
    fetch(`/api/socialos/posts?${params}`)
      .then((r) => r.json())
      .then((json: PostsData) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedPlatforms, selectedContentTypes, sortBy, page]);

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Posts</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Platform filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Platform{selectedPlatforms.length > 0 ? ` (${selectedPlatforms.length})` : ''}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {PLATFORMS.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={selectedPlatforms.includes(p)}
                onCheckedChange={(checked) => {
                  setSelectedPlatforms((prev) =>
                    checked ? [...prev, p] : prev.filter((x) => x !== p)
                  );
                  setPage(1);
                }}
              >
                {getPlatformLabel(p)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Content type filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Type{selectedContentTypes.length > 0 ? ` (${selectedContentTypes.length})` : ''}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {CONTENT_TYPES.map((ct) => (
              <DropdownMenuCheckboxItem
                key={ct}
                checked={selectedContentTypes.includes(ct)}
                onCheckedChange={(checked) => {
                  setSelectedContentTypes((prev) =>
                    checked ? [...prev, ct] : prev.filter((x) => x !== ct)
                  );
                  setPage(1);
                }}
              >
                {getContentTypeLabel(ct)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort select */}
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>

        <span className="text-sm text-muted-foreground">
          Showing {Math.min(LIMIT, data?.posts.length ?? 0)} of {data?.total ?? 0} posts
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead className="text-right">Reach</TableHead>
              <TableHead className="text-right">Engagements</TableHead>
              <TableHead className="text-right">Eng. Rate</TableHead>
              <TableHead className="text-right">Discovery</TableHead>
              <TableHead className="text-right">Saves</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data && data.posts.length > 0 ? (
              data.posts.map((post) => {
                const platformColor = getPlatformColor(post.platform);
                const ctColor = CONTENT_TYPE_COLORS[post.contentType] ?? '#6b7280';
                const totalEngagements = post.likes + post.comments + post.shares;
                const captionText = post.caption ?? '';
                const truncatedCaption =
                  captionText.length > 60
                    ? captionText.slice(0, 60) + '...'
                    : captionText;

                return (
                  <TableRow key={post.id}>
                    {/* Platform */}
                    <TableCell>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: platformColor + '20',
                          color: platformColor,
                        }}
                      >
                        {getPlatformLabel(post.platform)}
                      </span>
                    </TableCell>

                    {/* Content type */}
                    <TableCell>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: ctColor + '20',
                          color: ctColor,
                        }}
                      >
                        {getContentTypeLabel(post.contentType)}
                      </span>
                    </TableCell>

                    {/* Caption */}
                    <TableCell
                      title={captionText}
                      className="max-w-[200px] text-sm text-muted-foreground"
                    >
                      {truncatedCaption}
                    </TableCell>

                    {/* Posted */}
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatPostedAt(post.postedAt)}
                    </TableCell>

                    {/* Reach */}
                    <TableCell className="text-right text-sm">
                      {post.reach.toLocaleString()}
                    </TableCell>

                    {/* Engagements */}
                    <TableCell className="text-right text-sm">
                      {totalEngagements.toLocaleString()}
                    </TableCell>

                    {/* Eng. Rate */}
                    <TableCell className="text-right">
                      <EngRateBadge rate={post.engagementRate} />
                    </TableCell>

                    {/* Discovery Score */}
                    <TableCell className="text-right text-sm">
                      <span
                        className={
                          post.discoveryScore > 1.0
                            ? 'text-teal-600 font-medium'
                            : 'text-gray-500'
                        }
                      >
                        {post.discoveryScore.toFixed(2)}x
                      </span>
                    </TableCell>

                    {/* Saves */}
                    <TableCell className="text-right text-sm">
                      {post.saves.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No posts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          variant="outline"
          size="sm"
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages > 0 ? totalPages : 1}
        </span>
        <Button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages}
          variant="outline"
          size="sm"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function calcEngagementRate(post: {
  likes: number; comments: number; shares: number; reach: number
}): number {
  if (post.reach === 0) return 0;
  return (post.likes + post.comments + post.shares) / post.reach;
}

export function calcDiscoveryScore(post: {
  reach: number; followerCountAtPostTime: number
}): number {
  if (post.followerCountAtPostTime === 0) return 0;
  return post.reach / post.followerCountAtPostTime;
}

export function formatDiscoveryScore(n: number): string {
  return n.toFixed(2) + "x";
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatEngagementRate(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: "#E1306C",
    tiktok: "#69C9D0",
    linkedin: "#0A66C2",
    facebook: "#1877F2",
    youtube: "#FF0000",
  };
  return colors[platform] ?? "#888888";
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    youtube: "YouTube",
  };
  return labels[platform] ?? platform;
}

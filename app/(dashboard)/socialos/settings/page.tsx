'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Hardcoded workspace for now — matches what the dashboard uses
const WORKSPACE_ID = 'acme-brand';

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    description: 'Connect your Instagram Business account for posts and insights.',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    description: 'Connect your Facebook Page for page insights and post analytics.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    description: 'Connect your TikTok account for video analytics.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    description: 'Connect your LinkedIn profile or organization page.',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    description: 'Connect your YouTube channel for video and analytics data.',
  },
] as const;

type PlatformId = (typeof PLATFORMS)[number]['id'];

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  avatarUrl: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  isActive: boolean;
  errorMessage: string | null;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchConnections = useCallback(async () => {
    try {
      const resp = await fetch(`/api/socialos/connections?workspaceId=${WORKSPACE_ID}`);
      const data = (await resp.json()) as { connections: Connection[]; error?: string };
      if (resp.ok) {
        setConnections(data.connections ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      showToast('Account connected successfully!', 'success');
    } else if (searchParams.get('error')) {
      showToast(`Connection failed: ${searchParams.get('error')}`, 'error');
    }
  }, [searchParams]);

  const handleConnect = (platformId: PlatformId) => {
    window.location.href = `/api/socialos/connect/${platformId}?workspaceId=${WORKSPACE_ID}`;
  };

  const handleSync = async (connectionId: string, platformLabel: string) => {
    setSyncingId(connectionId);
    try {
      const resp = await fetch('/api/socialos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const result = (await resp.json()) as { success: boolean; error?: string; postsUpserted?: number; metricsUpserted?: number };
      if (result.success) {
        showToast(`${platformLabel} synced — ${result.postsUpserted ?? 0} posts, ${result.metricsUpserted ?? 0} metrics updated.`);
        await fetchConnections();
      } else {
        showToast(`Sync failed: ${result.error ?? 'Unknown error'}`, 'error');
      }
    } catch {
      showToast('Sync request failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (connectionId: string, platformLabel: string) => {
    if (!confirm(`Disconnect ${platformLabel}? You can reconnect at any time.`)) return;
    setDisconnectingId(connectionId);
    try {
      const resp = await fetch(`/api/socialos/connections?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      if (resp.ok) {
        showToast(`${platformLabel} disconnected.`);
        await fetchConnections();
      } else {
        showToast('Failed to disconnect', 'error');
      }
    } catch {
      showToast('Request failed', 'error');
    } finally {
      setDisconnectingId(null);
    }
  };

  const getConnectionForPlatform = (platformId: string): Connection | undefined => {
    return connections.find((c) => c.platform === platformId && c.isActive);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold">Connected Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your social media accounts to start syncing analytics data.
        </p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map((platform) => {
          const connection = getConnectionForPlatform(platform.id);
          const isSyncing = connection ? syncingId === connection.id : false;
          const isDisconnecting = connection ? disconnectingId === connection.id : false;

          return (
            <Card key={platform.id} className="border-l-4" style={{ borderLeftColor: platform.color }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{platform.label}</CardTitle>
                  {connection ? (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      connection.errorMessage
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {connection.errorMessage ? 'Error' : 'Active'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-500">
                      Not connected
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
                ) : connection ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {connection.avatarUrl && (
                        <img
                          src={connection.avatarUrl}
                          alt={connection.accountName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium text-sm">{connection.accountName}</div>
                        <div className="text-xs text-muted-foreground">
                          Last synced: {formatRelativeTime(connection.lastSyncAt)}
                        </div>
                      </div>
                    </div>
                    {connection.errorMessage && (
                      <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                        {connection.errorMessage}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(connection.id, platform.label)}
                        disabled={isSyncing || isDisconnecting}
                      >
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDisconnect(connection.id, platform.label)}
                        disabled={isSyncing || isDisconnecting}
                      >
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{platform.description}</p>
                    <Button
                      size="sm"
                      onClick={() => handleConnect(platform.id)}
                    >
                      Connect {platform.label}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

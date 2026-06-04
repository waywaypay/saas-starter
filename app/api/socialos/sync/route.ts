import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { syncPlatform } from '@/lib/socialos/sync/index';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { connectionId?: string };
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    const result = await syncPlatform(connectionId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Sync route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

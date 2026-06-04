export interface SyncResult {
  success: boolean;
  postsUpserted: number;
  metricsUpserted: number;
  error?: string;
}

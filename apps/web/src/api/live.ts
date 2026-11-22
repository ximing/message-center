import { request } from "./http";

export type LiveFeed = {
  revision: string;
  changed: boolean;
};

export function readLive(since: string | null): Promise<LiveFeed> {
  const path = since === null ? "/api/me/live" : `/api/me/live?since=${since}`;
  return request<LiveFeed>(path);
}

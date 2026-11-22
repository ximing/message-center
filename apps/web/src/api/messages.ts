import { readItems, request } from "./http";
import type { MessageItem } from "./types";

function withDeliveries(item: MessageItem): MessageItem {
  return {
    ...item,
    deliveries: Array.isArray(item.deliveries) ? item.deliveries : [],
  };
}

export function listMessages(): Promise<MessageItem[]> {
  return request<unknown>("/api/me/messages").then((data) =>
    readItems<MessageItem>(data).map(withDeliveries),
  );
}

export async function getMessage(id: string): Promise<MessageItem> {
  const data = await request<MessageItem>(
    `/api/me/messages/${encodeURIComponent(id)}`,
  );
  return withDeliveries(data);
}

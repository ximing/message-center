export type User = {
  id: string;
  email: string;
  displayName: string | null;
};

export type ApiKey = {
  id: string;
  name: string;
  note: string;
  preview: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

export type AccessToken = {
  id: string;
  name: string;
  preview: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

export type Provider = "inwit" | "vital" | "aimo";

export const PROVIDERS: readonly Provider[] = ["inwit", "vital", "aimo"];

export const DEFAULT_API_BASE: Record<Provider, string> = {
  inwit: "https://inwit.aimo.plus",
  vital: "https://vital.aimo.plus",
  aimo: "https://aimo.plus",
};

export type Connection = {
  id: string;
  provider: Provider | string;
  label: string;
  apiBase?: string | null;
  tokenPreview?: string | null;
  preview?: string | null;
  remoteUserId?: string;
  remoteDisplayName?: string | null;
  status?: string | null;
  allowImage?: boolean;
  allowVoice?: boolean;
};

export type Ingress = "wechat" | "webhook";

export type Rule = {
  id: string;
  name: string;
  enabled?: boolean;
  exclusive?: boolean;
  matchIngress?: Ingress | string | null;
  matchRoom?: string | null;
  matchSender?: string | null;
  connectionId: string;
};

export type RuleInput = {
  name: string;
  enabled: boolean;
  exclusive: boolean;
  matchIngress: Ingress | null;
  matchRoom: string | null;
  matchSender: string | null;
  connectionId: string;
};

export type RulePatch = {
  name?: string;
  enabled?: boolean;
  exclusive?: boolean;
  matchIngress?: Ingress | null;
  matchRoom?: string | null;
  matchSender?: string | null;
  connectionId?: string;
};

export type ConnectionInput = {
  provider: Provider;
  label: string;
  apiBase: string;
  token: string;
  allowImage: boolean;
  allowVoice: boolean;
};

export type ConnectionPatch = {
  label?: string;
  allowImage?: boolean;
  allowVoice?: boolean;
  token?: string;
};

export type Delivery = {
  id: string;
  ruleId?: string | null;
  connectionId?: string;
  attempts?: number;
  nextAttemptAt?: string | null;
  provider?: string | null;
  status?: string | null;
  skipReason?: string | null;
  remoteId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
};

export type MessageItem = {
  id: string;
  ingress?: string | null;
  sender?: string | null;
  room?: string | null;
  kind?: string | null;
  createdAt?: string | null;
  deliveries?: Delivery[] | null;
  body?: string | null;
};

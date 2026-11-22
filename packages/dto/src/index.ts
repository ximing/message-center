import { z } from "zod";

export const INGRESS_CHANNELS = ["wechat", "webhook"] as const;
export const EGRESS_PROVIDERS = ["inwit", "vital", "aimo"] as const;
export const MESSAGE_KINDS = ["text", "link", "image", "voice"] as const;
export const DELIVERY_STATUSES = [
  "queued",
  "delivered",
  "skipped",
  "failed",
] as const;
export const CONNECTION_STATUSES = ["active", "unauthorized"] as const;

export type IngressChannel = (typeof INGRESS_CHANNELS)[number];
export type EgressProvider = (typeof EGRESS_PROVIDERS)[number];
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const ingressSchema = z.enum(INGRESS_CHANNELS);
export const providerSchema = z.enum(EGRESS_PROVIDERS);
export const messageKindSchema = z.enum(MESSAGE_KINDS);

export const API_KEY_MAX_PER_USER = 20;
export const API_KEY_PREFIX = "mck_";
export const ACCESS_TOKEN_MAX_PER_USER = 20;
export const ACCESS_TOKEN_PREFIX = "mct_";
export const CONTENT_MAX_BYTES = 64 * 1024;

export const registerInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = registerInputSchema;
export type LoginInput = z.infer<typeof loginInputSchema>;

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  tokens: authTokensSchema.optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authModeSchema = z.enum(["cookie", "bearer"]);
export type AuthMode = z.infer<typeof authModeSchema>;

export const oidcStatusSchema = z.object({
  enabled: z.boolean(),
});
export type OidcStatus = z.infer<typeof oidcStatusSchema>;

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  note: z.string().trim().max(500),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export const patchApiKeyInputSchema = createApiKeyInputSchema
  .partial()
  .refine((value) => value.name !== undefined || value.note !== undefined, {
    message: "at least one field required",
  });
export type PatchApiKeyInput = z.infer<typeof patchApiKeyInputSchema>;

export const createAccessTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
export type CreateAccessTokenInput = z.infer<typeof createAccessTokenInputSchema>;

export const patchAccessTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
export type PatchAccessTokenInput = z.infer<typeof patchAccessTokenInputSchema>;

export const createConnectionInputSchema = z.object({
  provider: providerSchema,
  label: z.string().trim().min(1).max(64),
  apiBase: z.string().trim().min(1).max(512).optional(),
  token: z.string().trim().min(1).max(4096),
  allowImage: z.boolean().optional(),
  allowVoice: z.boolean().optional(),
});
export type CreateConnectionInput = z.infer<typeof createConnectionInputSchema>;

export const patchConnectionInputSchema = z
  .object({
    label: z.string().trim().min(1).max(64).optional(),
    allowImage: z.boolean().optional(),
    allowVoice: z.boolean().optional(),
    token: z.string().trim().min(1).max(4096).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "at least one field required",
  });
export type PatchConnectionInput = z.infer<typeof patchConnectionInputSchema>;

const nullableMatch = z.string().trim().max(256).nullable().optional();

export const createRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  enabled: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  matchIngress: ingressSchema.nullable().optional(),
  matchRoom: nullableMatch,
  matchSender: nullableMatch,
  connectionId: z.string().uuid(),
});
export type CreateRuleInput = z.infer<typeof createRuleInputSchema>;

export const patchRuleInputSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    enabled: z.boolean().optional(),
    exclusive: z.boolean().optional(),
    matchIngress: ingressSchema.nullable().optional(),
    matchRoom: nullableMatch,
    matchSender: nullableMatch,
    connectionId: z.string().uuid().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "at least one field required",
  });
export type PatchRuleInput = z.infer<typeof patchRuleInputSchema>;

/** Signed long, no leading zeros. JavaScript numbers above MAX_SAFE_INTEGER are rejected. */
const msgSvrIdDecimal = /^-?(?:0|[1-9]\d{0,18})$/;

export const msgSvrIdSchema = z
  .union([
    z
      .number()
      .int()
      .refine((value) => Number.isSafeInteger(value), {
        message: "msgSvrId exceeds Number.MAX_SAFE_INTEGER; send a decimal string",
      }),
    z.string().regex(msgSvrIdDecimal),
  ])
  .transform((value) => (typeof value === "number" ? String(value) : value));

export const wechatIngestSchema = z.object({
  moduleBuild: z.string().min(1).max(128),
  type: z.number().int(),
  isSend: z.number().int(),
  talker: z.string().max(512),
  fromUser: z.string().max(512),
  content: z.string().max(700_000),
  msgSvrId: msgSvrIdSchema,
  createTime: z.number().int(),
});
export type WechatIngestInput = z.infer<typeof wechatIngestSchema>;

export const webhookIngestSchema = z.object({
  eventId: z.string().min(1).max(512),
  kind: messageKindSchema,
  sender: z.string().max(512),
  room: z.string().max(512).nullable().optional(),
  text: z.string().max(700_000).nullable().optional(),
  url: z.string().max(4096).nullable().optional(),
  title: z.string().max(2000).nullable().optional(),
});
export type WebhookIngestInput = z.infer<typeof webhookIngestSchema>;

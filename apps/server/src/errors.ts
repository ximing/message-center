export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "请求参数不合法",
  NOT_FOUND: "资源不存在",
  INVALID_CREDENTIALS: "邮箱或密码错误",
  INVALID_TOKEN: "登录已过期",
  INTERNAL_ERROR: "服务器内部错误",
  EMAIL_ALREADY_REGISTERED: "邮箱已注册",
  INVALID_APP_KEY: "密钥无效",
  API_KEY_LIMIT: "最多 20 把密钥",
  API_KEY_NOT_FOUND: "密钥不存在",
  CONNECTION_REJECTED: "连接校验失败",
  CONNECTION_NOT_FOUND: "连接不存在",
  CONNECTION_IN_USE: "连接仍被规则或投递使用",
  RULE_NOT_FOUND: "规则不存在",
  RULE_IN_USE: "规则已有历史投递记录，请停用规则以保留投递轨迹",
  MESSAGE_NOT_FOUND: "消息不存在",
  CONTENT_TOO_LARGE: "正文超过 64 KiB",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static of(status: number, code: ErrorCode, details?: unknown): AppError {
    if (details !== undefined) {
      return new AppError(status, code, ERROR_MESSAGES[code], details);
    }
    return new AppError(status, code, ERROR_MESSAGES[code]);
  }
}

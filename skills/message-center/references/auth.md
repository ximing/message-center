# 登录与当前用户

Agent 用接口令牌，不走注册、登录或统一账号。下面的会话接口给浏览器。不要为了调用管理接口去要用户密码。

### GET `/api/auth/me`

auth=token · 200

当前用户：`{ id, email, displayName }`。`id` 是 uuid。

### POST `/api/auth/register`

auth=none · 201

浏览器注册。body：`{ email, password }`，密码 8–128。无 `Origin` 或 `Origin` 不是网页源时，响应含 `tokens.accessToken`（约 15 分钟）和 `tokens.refreshToken`。

### POST `/api/auth/login`

auth=none · 200

同注册的 body。错误 `INVALID_CREDENTIALS`。

### POST `/api/auth/refresh`

auth=none · 200

body：`{ refreshToken }`。换发访问 JWT。不换接口令牌。

### POST `/api/auth/logout`

auth=none · 204

浏览器带着会话 cookie 或访问 JWT 调用时，`sessionVersion` 加一，访问 JWT 失效。**不吊销** `mct_`。Agent 不要用它来停接口令牌。

### GET `/api/auth/oidc/status`

auth=none · 200

`{ enabled: boolean }`。`start` / `callback` 是浏览器跳转，不在 catalog 里。

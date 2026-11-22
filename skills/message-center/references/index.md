# API 模块索引

按意图只读其中一个文件。不要一次打开多个模块，也不要读 `api.json`。

| 模块 | 文件 | 条数 |
|---|---|---|
| 登录与当前用户 | [auth.md](./auth.md) | 6 |
| 接口令牌 | [tokens.md](./tokens.md) | 5 |
| 接入密钥 | [keys.md](./keys.md) | 5 |
| 目的地连接 | [connections.md](./connections.md) | 4 |
| 转发规则 | [rules.md](./rules.md) | 4 |
| 消息与投递 | [messages.md](./messages.md) | 2 |
| 上报 | [ingest.md](./ingest.md) | 2 |

`GET /health` 无鉴权，返回 `{"ok":true}`。不在上表里。

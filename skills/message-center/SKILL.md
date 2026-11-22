---
name: message-center
description: >
  Operate the user's Message Center over HTTP: interface tokens, ingest keys,
  destination connections, forward rules, and delivery history. Use when the
  user mentions 消息中心, message-center, msg.aimo.plus, 接口令牌, mct_, mck_,
  转发规则, or runs /message-center. Call catalog endpoints with MC_TOKEN;
  do not invent APIs.
---

# Message Center

消息中心把微信和 Webhook 上报，按规则转发到 inwit、Vital、aimo。本 skill 用 HTTP 操作**当前用户的实例**。

你是控制台，不是第二条转发通道。要让一条消息进 inwit、Vital 或 aimo，就保存连接和规则。不要自己拿着目的地令牌去写对方。

接口形状以 `references/` 下**当前意图对应的那一个模块**为准。禁止读 `api.json`，禁止一次打开多个模块 md。

## 每个会话

`SKILL_DIR` = 本文件所在目录。

```bash
node "$SKILL_DIR/scripts/message-center.mjs" call GET /api/auth/me
```

需要某条接口的 body 时：先按意图 **Read 下表中的一个 md**，或 `show METHOD PATH`。不要用无过滤的 `catalog` 当 schema 来源。

## 凭证

| 变量 | 用途 |
|---|---|
| `MC_TOKEN` | 控制台 **接口令牌** 明文，前缀 `mct_`。写入环境变量，不要写入对话或仓库文件。 |
| `MC_API_KEY` | 接入密钥，前缀 `mck_`。只用于两个上报接口。 |
| `MC_BASE_URL` | API 根。缺省 `http://localhost:3030`。线上是 `https://msg.aimo.plus`。 |

管理路由用 `Authorization: Bearer $MC_TOKEN`。上报路由用 `Authorization: Bearer $MC_API_KEY`。两把不能互换。

`MC_TOKEN` 未设置时，管理类 `call` 会失败并提示。去控制台 **接口令牌** 创建或显示令牌，让用户放到环境变量后再继续。不要打印完整 `mct_`、`mck_`、`iwt_`、`vt_`、`aimo_tk_`。用户这一轮明确要求复制时，只给那一把，且只给一次。

退出登录不吊销 `mct_`。要停掉它，用删除接口令牌。

## 领域

| 实体 | 做什么 |
|---|---|
| 接口令牌 `mct_` | 管理这个账号。不能上报 |
| 接入密钥 `mck_` | 只上报微信或 Webhook。不能读规则、连接、消息 |
| Connection | 一条目的地：inwit / vital / aimo，外加图片和语音开关 |
| Rule | 匹配上报渠道、房间、发送者，指向一条连接。可独占 |
| Message | 已收下的上报。列表不含正文；详情才有 `body` |
| Delivery | 一条消息在一条连接上的转发结果 |

规则看规范化之后的消息。微信群：发送者是正文前缀（`wxid_` 或带 `@`），房间是以 `@chatroom` 结尾的 `talker`。微信单聊：发送者是 `fromUser`，空了再用 `talker`，房间为空。Webhook 用调用方给的发送者和房间。

命中的启用规则都转发。其中若有独占，只保留独占的那些。同一条连接只投一次。没有命中：消息留下，状态为未匹配。

图片和语音：连接上的开关默认关，该投递是 `skipped` / `media_disabled`。打开后这一期仍是 `skipped` / `media_transport_pending`，不传字节。文本和链接不受开关影响。

同一条上报再来一次时，响应是 200 而不是 202，不新增投递。不要为了「没看到新记录」重发同样的 `msgSvrId` 或 `eventId`。

## 意图 → 只读一个模块

PATH 参数把 `:id` 换成实值。然后 `call METHOD PATH`。

| 用户要… | 只 Read | 先调 |
|---|---|---|
| 连通 / 我是谁 | （不必读模块） | `call GET /api/auth/me` |
| 接口令牌 | [references/tokens.md](references/tokens.md) | `GET /api/me/access-tokens` |
| 接入密钥 | [references/keys.md](references/keys.md) | `GET /api/me/api-keys` |
| 目的地连接 | [references/connections.md](references/connections.md) | `GET /api/me/connections` |
| 转发规则 | [references/rules.md](references/rules.md) | `GET /api/me/rules` |
| 消息和投递 | [references/messages.md](references/messages.md) | `GET /api/me/messages` |
| 试上报 | [references/ingest.md](references/ingest.md) | 用 `mck_` |
| 登录方式 | [references/auth.md](references/auth.md) | 见该模块 |

上表没有的说明见 [references/index.md](references/index.md)。不要把所有模块打开。

Body：`--json '{"name":"agent"}'` 或 `--file /tmp/body.json`。大段正文走 `--file`。

## 约束

- 目的地令牌只出现在创建或更换连接的请求体里。列表没有明文。不要回显。
- 吊销接口令牌、吊销接入密钥、删除连接、删除规则前，先简述影响并得到用户确认。
- 规则已有投递时删除会 409 `RULE_IN_USE`。停用规则（`enabled: false`），不要删。
- 连接仍被规则或投递使用时删除会 409 `CONNECTION_IN_USE`。
- 错误体：`{"error":{"code":"…","message":"…","details":…}}`。把 `code` + `message` 告诉用户，不要把请求头里的令牌一并倒出。
- `MC_TOKEN` 和 `MC_API_KEY` 只从环境读。

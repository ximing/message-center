# 目的地连接

保存前会用令牌向对方要一次「我是谁」。失败不保存，400 `CONNECTION_REJECTED`。列表和详情都不回明文。

| provider | 令牌前缀 | 缺省 apiBase | 校验 |
|---|---|---|---|
| `vital` | `vt_` | `https://vital.aimo.plus` | `GET /api/v1/auth/me` |
| `inwit` | `iwt_` | `https://inwit.aimo.plus` | `GET /api/auth/me` |
| `aimo` | `aimo_tk_` | `https://aimo.plus` | `GET /api/v1/user/info` |

`apiBase` 可省略。给出时必须是 https origin：没有用户名、路径、query、fragment。

### GET `/api/me/connections`

auth=token · 200

数组。元素：`{ id, provider, label, apiBase, preview, remoteUserId, remoteDisplayName, status, allowImage, allowVoice }`。

`status` 是 `active` 或 `unauthorized`。某次转发得到 401 时，只这一条变成 `unauthorized`。

### POST `/api/me/connections`

auth=token · 201

```json
{
  "provider": "inwit",
  "label": "学习",
  "token": "iwt_...",
  "allowImage": false,
  "allowVoice": false
}
```

`label` 1–64。`allowImage` / `allowVoice` 省略时为 false。`token` 最长 4096。

### PATCH `/api/me/connections/:id`

auth=token · 200

`label`、`allowImage`、`allowVoice`、`token` 至少一个。更换 `token` 会重新校验，成功后状态回到 `active`。不能改 `provider` 或 `apiBase`。不存在：404 `CONNECTION_NOT_FOUND`。

### DELETE `/api/me/connections/:id`

auth=token · 204

仍被规则或投递引用时 409 `CONNECTION_IN_USE`。确认后再调。

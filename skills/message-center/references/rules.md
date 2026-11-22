# 转发规则

一条规则指向**这个用户自己的**一条连接。连接不属于自己时 400 `VALIDATION_ERROR`。

匹配：

- `matchIngress` 空：微信和 Webhook 都算。否则只等于 `wechat` 或 `webhook`
- `matchRoom`、`matchSender` 空：该字段不限制。都填则两个都要命中
- 房间和发送者都空：匹配该用户的全部上报
- `enabled: false` 不命中
- 有独占命中时，非独占的不再投递。多条独占可以同时投
- 同一条连接只产生一条投递

### GET `/api/me/rules`

auth=token · 200

数组。元素：`{ id, name, enabled, exclusive, matchIngress, matchRoom, matchSender, connectionId }`。

### POST `/api/me/rules`

auth=token · 201

```json
{
  "name": "未命铭进 Vital",
  "enabled": true,
  "exclusive": false,
  "matchIngress": null,
  "matchRoom": null,
  "matchSender": "wxid_8139281393915",
  "connectionId": "uuid"
}
```

`name` 1–64。`enabled` 默认 true，`exclusive` 默认 false。`connectionId` 必填。空字符串的房间或发送者会存成 null。

### PATCH `/api/me/rules/:id`

auth=token · 200

上表字段至少一个。不存在：404 `RULE_NOT_FOUND`。

### DELETE `/api/me/rules/:id`

auth=token · 204

已有历史投递时 409 `RULE_IN_USE`。这时改 `enabled: false`，保留投递轨迹。确认后再删。

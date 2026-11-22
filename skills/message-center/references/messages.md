# 消息与投递

列表最多最新 200 条，**没有正文**。要看原文用详情。

投递 `status`：`queued`、`delivered`、`skipped`、`failed`。

`skipReason`：`media_disabled`（开关关）、`media_transport_pending`（开关开，这一期不传字节）。其它为 null。

看不到目的地令牌，也看不到对方错误正文。只有 `httpStatus` 和 `errorCode`。

### GET `/api/me/messages`

auth=token · 200

数组。元素：

```json
{
  "id": "uuid",
  "ingress": "wechat",
  "sender": "wxid_example",
  "room": null,
  "kind": "text",
  "createdAt": "2026-11-22T00:00:00.000Z",
  "apiKeyId": "uuid",
  "deliveries": []
}
```

`kind`：`text`、`link`、`image`、`voice`。`ingress`：`wechat`、`webhook`。没有 `deliveries` 就是未匹配。

### GET `/api/me/messages/:id`

auth=token · 200

列表元素再加 `body`。不存在：404 `MESSAGE_NOT_FOUND`。

`kind=link` 时 `body` 是 JSON 字符串：`{"title":"","url":"https://...","text":""}`。微信链接的 `text` 可能是空的，URL 来自 XML。

投递元素：`{ id, ruleId, connectionId, provider, status, skipReason, attempts, nextAttemptAt, remoteId, httpStatus, errorCode }`。

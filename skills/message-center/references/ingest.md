# 上报

这两条用 `MC_API_KEY`（`mck_`），不用 `MC_TOKEN`。`mct_` 打进来是 401 `INVALID_APP_KEY`。

新建返回 202，重复返回 200，正文都是消息摘要：`{ id, ingress, sender, room, kind, createdAt }`。重复不新增投递。

正文超过 64 KiB：413 `CONTENT_TOO_LARGE`。

### POST `/api/v1/ingest/wechat`

auth=apikey · 202 或 200

```json
{
  "moduleBuild": "1",
  "type": 1,
  "isSend": 0,
  "talker": "wxid_friend",
  "fromUser": "wxid_friend",
  "content": "正文",
  "msgSvrId": "6174103951083978474",
  "createTime": 1710000000
}
```

`msgSvrId` 用十进制字符串。安全整数也可以用 JSON 数字，服务端收成同一段数字。超过 `Number.MAX_SAFE_INTEGER` 的 JSON 数字返回 400。`isSend != 0` 拒绝。认识的 `type`：1 文本，低 16 位为 49 的链接，3/13/23/33/39 图片，34 语音。其它 400。文本和链接正文规范化后为空则 400。图片和语音可以没有正文。

### POST `/api/v1/ingest/webhook`

auth=apikey · 202 或 200

```json
{
  "eventId": "evt-1",
  "kind": "text",
  "sender": "browser-clipper",
  "room": null,
  "text": "一条消息",
  "url": null,
  "title": null
}
```

`kind`：`text`、`link`、`image`、`voice`。`sender` 不能空白。`text` 在 `kind=text` 时必填。`url` 在 `kind=link` 时必填。同一用户下 `eventId` 重复视为同一次上报。

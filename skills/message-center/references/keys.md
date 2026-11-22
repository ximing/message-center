# 接入密钥

前缀 `mck_`。只给两个上报接口用。每用户最多 20 把未吊销。不能用它读本模块以外的接口。

### GET `/api/me/api-keys`

auth=token · 200

数组。元素：`{ id, name, note, preview, createdAt, lastUsedAt }`。不含 `token`。

### POST `/api/me/api-keys`

auth=token · 201

```json
{ "name": "主力机", "note": "微信模块" }
```

`name` 1–64，`note` 0–500，备注不参与鉴权。响应含 `token`。到上限 409 `API_KEY_LIMIT`。

### POST `/api/me/api-keys/:id/reveal`

auth=token · 200

`{ "token": "mck_..." }`。已吊销或不存在：404 `API_KEY_NOT_FOUND`。

### PATCH `/api/me/api-keys/:id`

auth=token · 200

`name`、`note` 至少一个。不轮换明文。

### DELETE `/api/me/api-keys/:id`

auth=token · 204

吊销。微信和 Webhook 用这把密钥都立刻 401。确认后再调。同一用户的其它密钥继续可用。

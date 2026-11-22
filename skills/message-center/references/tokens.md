# 接口令牌

前缀 `mct_`。每用户最多 20 个未吊销。明文在创建响应和 reveal 里。列表只有预览。

### GET `/api/me/access-tokens`

auth=token · 200

数组。元素：`{ id, name, preview, createdAt, lastUsedAt }`。不含 `token`。

### POST `/api/me/access-tokens`

auth=token · 201

body：

```json
{ "name": "agent" }
```

`name` 1–64。响应是列表元素再加 `token`。到上限返回 409 `ACCESS_TOKEN_LIMIT`。

### POST `/api/me/access-tokens/:id/reveal`

auth=token · 200

`{ "token": "mct_..." }`。不是自己的、或已吊销：404 `ACCESS_TOKEN_NOT_FOUND`。

### PATCH `/api/me/access-tokens/:id`

auth=token · 200

body：`{ "name": "新名称" }`。不轮换明文。

### DELETE `/api/me/access-tokens/:id`

auth=token · 204

吊销。立即不能再调用管理接口。确认后再调。

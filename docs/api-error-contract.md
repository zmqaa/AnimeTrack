# API 错误响应约定

最后更新：2026-08-13

## 统一响应格式

应用自有 API 的非成功 JSON 响应统一包含可展示的中文提示和稳定错误码：

```json
{
  "error": "漫画不存在",
  "code": "NOT_FOUND"
}
```

前端继续向用户展示 `error`，需要区分错误类型时使用 `code`，不要依赖中文文案做判断。个别业务接口可以增加 `errors` 等补充字段，但不得覆盖 `error` 和 `code`。

## 错误码与 HTTP 状态

| 错误码 | HTTP 状态 | 使用场景 |
| --- | ---: | --- |
| `BAD_REQUEST` | 400 | JSON、参数、日期或业务输入无效 |
| `UNAUTHENTICATED` | 401 | 未登录、登录令牌过期或账号状态失效 |
| `FORBIDDEN` | 403 | 已确认身份，但没有执行当前操作的权限 |
| `NOT_FOUND` | 404 | 记录或文件不存在 |
| `CONFLICT` | 409 | 重复数据、唯一性冲突或当前状态不允许操作 |
| `RATE_LIMITED` | 429 | 请求频率超过限制 |
| `INTERNAL_ERROR` | 500 | 未预期的应用、数据库或文件错误 |
| `UPSTREAM_ERROR` | 502 | AI、Bangumi 等外部服务返回失败或无效结果 |
| `SERVICE_UNAVAILABLE` | 503 | 当前服务或必要依赖暂时不可用 |
| `UPSTREAM_TIMEOUT` | 504 | 外部服务响应超时 |

映射定义集中在 `lib/api-errors.ts`，不要在路由中自行维护另一套数字状态表。

## 路由实现规则

- 已预期、可安全展示的业务错误使用 `apiError(message, code)`。
- JSON 请求体使用 `readApiJson()`；格式错误会稳定映射为 `BAD_REQUEST`。
- 未预期异常使用 `apiInternalError()`，或用 `withApiErrorBoundary()` 包住路由。浏览器只收到稳定提示，完整异常留在服务器日志。
- 页面路由可以把未登录访问重定向到登录页；API 路由不得在代理层重定向，必须由 `requireAdmin()` 返回标准 401/403 JSON。
- 外部服务异常通过 `apiInternalError()` 的 `code` 指定为 `UPSTREAM_ERROR`、`SERVICE_UNAVAILABLE` 或 `UPSTREAM_TIMEOUT`，同时保留服务器日志。
- 日志上下文只允许记录 ID、页码、数量和布尔标记等低敏感简单值，不得放入请求体、密钥、备份内容或文件内容。
- 预期的 4xx 参数和资源错误默认不写错误日志，避免正常用户输入淹没真正故障。

## 边界与例外

- 成功响应保持各接口现有数据结构，不额外包裹统一外层对象。
- Excel、JSON 和封面等二进制或文件下载成功响应保持原内容类型；下载失败仍使用统一 JSON 错误。
- AI 快速录入的 NDJSON 流一旦开始发送，后续失败通过流内的 `type: "error"` 事件报告，无法再修改已经发送的 HTTP 状态。
- `/api/auth/[...nextauth]` 由 NextAuth 框架实现，保留框架协议要求的响应格式；应用自己的权限检查仍使用上述错误码。

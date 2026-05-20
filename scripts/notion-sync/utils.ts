import crypto from 'node:crypto'

/**
 * 去除 Notion ID 中的短横线，便于统一比较 pageId。
 *
 * @param pageId Notion page id，支持带短横线或不带短横线格式。
 * @returns 不带短横线的 Notion page id。
 */
export function normalizePageId(pageId: string): string {
  return pageId.replaceAll('-', '')
}

/**
 * 从环境变量或 Notion URL 中提取标准 Notion ID。
 *
 * @param value 环境变量、collection URL 或普通 Notion URL。
 * @returns 可用于 Notion API 的 ID；输入为空时返回 undefined。
 */
export function normalizeNotionId(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const withoutCollectionProtocol = trimmed.replace(/^collection:\/\//, '')
  const uuidMatch = withoutCollectionProtocol.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/)

  return uuidMatch?.[0] ?? withoutCollectionProtocol
}

/**
 * 读取正整数配置，非法值自动回退到默认值。
 *
 * @param value 原始环境变量值。
 * @param fallback 默认值。
 * @returns 正整数配置值。
 */
export function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 生成 sha256 十六进制摘要。
 *
 * @param value 待哈希文本。
 * @returns sha256 摘要。
 */
export function hashText(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * 生成 base64url 短摘要，用于图片文件名。
 *
 * @param value 待哈希文本。
 * @param length 截取长度。
 * @returns 小写短摘要。
 */
export function hashTextBase64Url(value: string, length: number): string {
  return crypto.createHash('sha256').update(value).digest('base64url').slice(0, length).toLowerCase()
}

/**
 * 根据路由片段生成 VitePress 站内链接。
 *
 * @param parts 路由片段。
 * @returns 以 `/` 开头的站内链接。
 */
export function toLink(parts: string[]): string {
  return `/${parts.join('/')}`
}

/**
 * 转义字符串，使其可以安全放入 TypeScript 字面量。
 *
 * @param value 原始字符串。
 * @returns JSON 字符串字面量。
 */
export function escapeTsString(value: string): string {
  return JSON.stringify(value)
}

/**
 * 判断未知值是否为普通对象。
 *
 * @param value 待判断值。
 * @returns 是否为非数组对象。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 判断异常是否为 Node.js 文件系统错误。
 *
 * @param error 捕获到的异常。
 * @returns 是否带有 code 字段。
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

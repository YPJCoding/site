import fs from 'node:fs/promises'
import path from 'node:path'
import { NOTION_ASSETS_DIR, NOTION_ASSETS_PUBLIC_BASE } from './paths'
import type { DownloadedImage, ImageAssetTarget, RouteNode } from './types'
import { fileExists } from './filesystem'
import { hashTextBase64Url, normalizePageId } from './utils'

/**
 * 下载 Notion 图片，并在本地文件存在时复用已有资源。
 *
 * @param imageUrl Notion Markdown 中的图片 URL。
 * @param node 当前文章节点，用于隔离资源目录。
 * @returns 本地 public 路径与文件路径；非 Notion 图片返回 undefined。
 */
export async function downloadNotionImageIfNeeded(imageUrl: string, node: RouteNode): Promise<DownloadedImage | undefined> {
  if (!shouldDownloadImage(imageUrl)) return undefined

  const urlExtension = getImageExtensionFromUrl(imageUrl)

  if (urlExtension) {
    const target = createImageAssetTarget(imageUrl, node, urlExtension)

    if (await fileExists(target.filePath)) {
      return target
    }
  }

  try {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.warn(`[notion-sync] Failed to download image in "${node.title}": ${response.status} ${imageUrl}`)
      return undefined
    }

    const contentType = response.headers.get('content-type') ?? ''
    const extension = urlExtension ?? getImageExtensionFromContentType(contentType)
    const target = createImageAssetTarget(imageUrl, node, extension)

    if (await fileExists(target.filePath)) {
      return target
    }

    const arrayBuffer = await response.arrayBuffer()

    await fs.mkdir(path.dirname(target.filePath), { recursive: true })
    await fs.writeFile(target.filePath, Buffer.from(arrayBuffer))

    return target
  } catch (error) {
    console.warn(`[notion-sync] Failed to download image in "${node.title}": ${imageUrl}`)
    if (error instanceof Error) {
      console.warn(`[notion-sync] ${error.message}`)
    }

    return undefined
  }
}

/**
 * 根据图片 URL 和文章节点生成稳定的本地图片目标路径。
 *
 * @param imageUrl Notion 图片 URL。
 * @param node 当前文章节点。
 * @param extension 图片扩展名，必须包含 `.`。
 * @returns public 路径和文件系统路径。
 */
function createImageAssetTarget(imageUrl: string, node: RouteNode, extension: string): ImageAssetTarget {
  const pageId = normalizePageId(node.id)
  const imageHash = hashTextBase64Url(`${pageId}:${imageUrl}`, 12)
  const pageAssetsDir = path.join(NOTION_ASSETS_DIR, pageId)
  const fileName = `${imageHash}${extension}`

  return {
    publicPath: `${NOTION_ASSETS_PUBLIC_BASE}/${pageId}/${fileName}`,
    filePath: path.join(pageAssetsDir, fileName),
  }
}

/**
 * 判断图片是否属于 Notion 上传或 Notion 托管资源。
 *
 * @param imageUrl 图片 URL。
 * @returns 是否需要下载到本地。
 */
function shouldDownloadImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const hostname = url.hostname.toLowerCase()

    return hostname.includes('notion.so')
      || hostname.includes('notion-static.com')
      || hostname.includes('notionusercontent.com')
      || hostname.includes('prod-files-secure')
      || hostname.includes('s3.us-west-2.amazonaws.com')
  } catch {
    return false
  }
}

/**
 * 根据响应 content-type 推断图片扩展名。
 *
 * @param contentType HTTP content-type。
 * @returns 图片扩展名。
 */
function getImageExtensionFromContentType(contentType: string): string {
  const normalizedContentType = contentType.split(';')[0]?.trim().toLowerCase()
  const contentTypeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
  }

  return contentTypeMap[normalizedContentType] ?? '.png'
}

/**
 * 从 URL path 中提取图片扩展名。
 *
 * @param imageUrl 图片 URL。
 * @returns 允许的图片扩展名；无法判断时返回 undefined。
 */
function getImageExtensionFromUrl(imageUrl: string): string | undefined {
  try {
    const url = new URL(imageUrl)
    const extension = path.extname(url.pathname).toLowerCase()
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])

    if (allowedExtensions.has(extension)) return extension
  } catch {
    return undefined
  }

  return undefined
}

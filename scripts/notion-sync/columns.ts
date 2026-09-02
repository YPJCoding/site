import type { Client, ListBlockChildrenResponse } from '@notionhq/client'
import type { NotionToMarkdown } from 'notion-to-md'

type ColumnListBlock = {
  id: string
}

type ColumnBlock = {
  id: string
  type?: string
}

type MarkdownBlocks = Parameters<NotionToMarkdown['blocksToMarkdown']>[0]

/**
 * Preserve Notion column layouts instead of letting notion-to-md flatten them.
 * The inner Markdown is kept inside HTML wrappers so VitePress can render it
 * normally while the resume stylesheet controls the layout.
 */
export function registerColumnListTransformer(notion: Client, n2m: NotionToMarkdown): void {
  n2m.setCustomTransformer('column_list', async (rawBlock) => {
    const block = rawBlock as unknown as ColumnListBlock
    const columns = (await listBlockChildren(notion, block.id))
      .filter(isColumnBlock)
      .map((column) => column as unknown as ColumnBlock)
    const renderedColumns = await Promise.all(
      columns.map(async (column) => {
        const children = await listBlockChildren(notion, column.id)
        const markdownBlocks = await n2m.blocksToMarkdown(children as MarkdownBlocks)
        const markdownResult = n2m.toMarkdownString(markdownBlocks)
        const content = (markdownResult.parent ?? '').trim()

        return `<div class="resume-column">\n\n${content}\n\n</div>`
      })
    )

    const columnCount = Math.max(columns.length, 1)
    return `<div class="resume-columns" data-column-count="${columnCount}" style="--resume-column-count: ${columnCount}">\n${renderedColumns.join('\n')}\n</div>`
  })
}

async function listBlockChildren(notion: Client, blockId: string): Promise<ListBlockChildrenResponse['results']> {
  const blocks: ListBlockChildrenResponse['results'] = []
  let startCursor: string | undefined

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })

    blocks.push(...response.results)
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (startCursor)

  return blocks
}

function isColumnBlock(block: ListBlockChildrenResponse['results'][number]): boolean {
  return 'id' in block && 'type' in block && block.type === 'column'
}

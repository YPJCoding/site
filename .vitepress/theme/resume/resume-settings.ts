export interface ResumeSettings {
  vertical: number
  horizontal: number
  lineHeight: number
  themeColor: string
}

export const DEFAULT_RESUME_SETTINGS: ResumeSettings = {
  vertical: 10,
  horizontal: 7,
  lineHeight: 28,
  themeColor: '#2563eb',
}

const VERTICAL_MARGIN_MIN = 5
const VERTICAL_MARGIN_MAX = 40
const HORIZONTAL_MARGIN_MIN = 5
const HORIZONTAL_MARGIN_MAX = 35
const LINE_HEIGHT_MIN = 16
const LINE_HEIGHT_MAX = 32
const STORAGE_PREFIX = 'vitepress:resume-margins:'

export function normalizeResumeSettings(
  value: Partial<ResumeSettings>,
  fallback: ResumeSettings = DEFAULT_RESUME_SETTINGS,
): ResumeSettings {
  return {
    vertical: clampMargin(value.vertical, fallback.vertical, VERTICAL_MARGIN_MIN, VERTICAL_MARGIN_MAX),
    horizontal: clampMargin(value.horizontal, fallback.horizontal, HORIZONTAL_MARGIN_MIN, HORIZONTAL_MARGIN_MAX),
    lineHeight: clampLineHeight(value.lineHeight, fallback.lineHeight),
    themeColor: normalizeThemeColor(value.themeColor, fallback.themeColor),
  }
}

export function loadResumeSettings(routePath: string): ResumeSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_RESUME_SETTINGS }

  try {
    const raw = window.localStorage.getItem(getStorageKey(routePath))
    if (!raw) return { ...DEFAULT_RESUME_SETTINGS }

    return normalizeResumeSettings(JSON.parse(raw) as Partial<ResumeSettings>)
  } catch {
    return { ...DEFAULT_RESUME_SETTINGS }
  }
}

export function saveResumeSettings(routePath: string, settings: ResumeSettings): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getStorageKey(routePath), JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

function getStorageKey(routePath: string): string {
  return `${STORAGE_PREFIX}${routePath || '/'}`
}

function clampMargin(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Number(value)))
}

function clampLineHeight(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback

  // Settings created before line-height became a pixel value stored a unitless
  // multiplier. Convert those values to the equivalent 14px body-font spacing.
  const pixelValue = Number(value) < 4 ? Math.round(Number(value) * 14) : Number(value)
  return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, pixelValue))
}

function normalizeThemeColor(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

export function getResumeCodeBackgroundColor(themeColor: string): string {
  const normalized = normalizeThemeColor(themeColor, DEFAULT_RESUME_SETTINGS.themeColor)
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)

  return `rgba(${red}, ${green}, ${blue}, 0.12)`
}

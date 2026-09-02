<script setup lang="ts">
import { ref, watch } from 'vue'

type SettingField = 'verticalMargin' | 'horizontalMargin' | 'lineHeight'

const props = defineProps<{
  verticalMargin: number
  horizontalMargin: number
  lineHeight: number
  themeColor: string
}>()

const verticalDraft = ref(String(props.verticalMargin))
const horizontalDraft = ref(String(props.horizontalMargin))
const lineHeightDraft = ref(String(props.lineHeight))

const emit = defineEmits<{
  (event: 'update:verticalMargin', value: number): void
  (event: 'update:horizontalMargin', value: number): void
  (event: 'update:lineHeight', value: number): void
  (event: 'update:themeColor', value: string): void
  (event: 'reset'): void
}>()

const fieldConfig: Record<SettingField, { min: number; max: number; step: number }> = {
  verticalMargin: { min: 5, max: 40, step: 1 },
  horizontalMargin: { min: 5, max: 35, step: 1 },
  lineHeight: { min: 16, max: 32, step: 1 },
}

watch(() => props.verticalMargin, (value) => {
  verticalDraft.value = String(value)
})

watch(() => props.horizontalMargin, (value) => {
  horizontalDraft.value = String(value)
})

watch(() => props.lineHeight, (value) => {
  lineHeightDraft.value = String(value)
})

function updateDraft(event: Event, field: SettingField): void {
  const input = event.target as HTMLInputElement
  setDraft(field, input.value)
}

function updateThemeColor(event: Event): void {
  const input = event.target as HTMLInputElement
  emit('update:themeColor', input.value)
}

function commitValue(event: Event, field: SettingField): void {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  const normalized = normalizeValue(value, field)

  if (normalized === undefined) {
    setDraft(field, getPropValue(field))
    return
  }

  setDraft(field, normalized)
  emitValue(field, normalized)
}

function stepValue(field: SettingField, direction: -1 | 1): void {
  const config = fieldConfig[field]
  const draftValue = Number(getDraft(field))
  const current = Number.isFinite(draftValue) ? draftValue : getPropValue(field)
  const next = Math.min(config.max, Math.max(config.min, current + direction * config.step))
  const normalized = field === 'lineHeight' ? Math.round(next) : next

  setDraft(field, normalized)
  emitValue(field, normalized)
}

function normalizeValue(value: number, field: SettingField): number | undefined {
  if (!Number.isFinite(value)) return undefined

  const config = fieldConfig[field]
  const normalized = Math.min(config.max, Math.max(config.min, value))
  return field === 'lineHeight' ? Math.round(normalized) : normalized
}

function emitValue(field: SettingField, value: number): void {
  if (field === 'verticalMargin') emit('update:verticalMargin', value)
  else if (field === 'horizontalMargin') emit('update:horizontalMargin', value)
  else emit('update:lineHeight', value)
}

function getDraft(field: SettingField): string {
  if (field === 'verticalMargin') return verticalDraft.value
  if (field === 'horizontalMargin') return horizontalDraft.value
  return lineHeightDraft.value
}

function getPropValue(field: SettingField): number {
  if (field === 'verticalMargin') return props.verticalMargin
  if (field === 'horizontalMargin') return props.horizontalMargin
  return props.lineHeight
}

function setDraft(field: SettingField, value: number | string): void {
  if (field === 'verticalMargin') verticalDraft.value = String(value)
  else if (field === 'horizontalMargin') horizontalDraft.value = String(value)
  else lineHeightDraft.value = String(value)
}
</script>

<template>
  <div class="resume-settings-toolbar" role="group" aria-label="简历页面设置">
    <div class="resume-settings-control" data-tooltip="上下边距（mm）">
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="减少上下边距"
        @click="stepValue('verticalMargin', -1)"
      >
        −
      </button>
      <input
        type="number"
        min="5"
        max="40"
        step="1"
        :value="verticalDraft"
        aria-label="上下边距，单位毫米"
        @input="updateDraft($event, 'verticalMargin')"
        @change="commitValue($event, 'verticalMargin')"
        @keyup.enter="commitValue($event, 'verticalMargin')"
      >
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="增加上下边距"
        @click="stepValue('verticalMargin', 1)"
      >
        +
      </button>
    </div>

    <div class="resume-settings-control" data-tooltip="左右边距（mm）">
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="减少左右边距"
        @click="stepValue('horizontalMargin', -1)"
      >
        −
      </button>
      <input
        type="number"
        min="5"
        max="35"
        step="1"
        :value="horizontalDraft"
        aria-label="左右边距，单位毫米"
        @input="updateDraft($event, 'horizontalMargin')"
        @change="commitValue($event, 'horizontalMargin')"
        @keyup.enter="commitValue($event, 'horizontalMargin')"
      >
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="增加左右边距"
        @click="stepValue('horizontalMargin', 1)"
      >
        +
      </button>
    </div>

    <div class="resume-settings-control" data-tooltip="行间距（px）">
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="减小行间距"
        @click="stepValue('lineHeight', -1)"
      >
        −
      </button>
      <input
        type="number"
        min="16"
        max="32"
        step="1"
        :value="lineHeightDraft"
        aria-label="行间距，单位像素"
        @input="updateDraft($event, 'lineHeight')"
        @change="commitValue($event, 'lineHeight')"
        @keyup.enter="commitValue($event, 'lineHeight')"
      >
      <button
        class="resume-settings-step-button"
        type="button"
        aria-label="增大行间距"
        @click="stepValue('lineHeight', 1)"
      >
        +
      </button>
    </div>

    <div class="resume-settings-control resume-theme-control" data-tooltip="主题色">
      <input
        type="color"
        :value="themeColor"
        aria-label="主题色"
        @input="updateThemeColor"
      >
    </div>

    <button
      class="resume-settings-reset"
      type="button"
      title="恢复默认页面设置"
      @click="emit('reset')"
    >
      重置
    </button>
  </div>
</template>

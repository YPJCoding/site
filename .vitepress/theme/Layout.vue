<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ResumeLayout from './resume/ResumeLayout.vue'

const { frontmatter } = useData()
</script>

<template>
  <ResumeLayout v-if="frontmatter.resume === true" />
  <DefaultTheme.Layout v-else />
</template>

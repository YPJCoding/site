import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './index.css'
import './resume/resume.css'
import './resume/resume-renderer.css'
import Layout from './Layout.vue'
import { installResumeMode } from './resume/resume-mode'

// ResumeLayout keeps the default VitePress shell and exposes a renderer slot.
// The document-level marker is maintained separately so resume CSS never leaks
// into ordinary pages.
export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(context) {
    installResumeMode(context)
  },
} as Theme

import { defineConfig } from 'vite'

/** GitHub Pages serves the site at /hanabi-taikai/. Local dev and preview stay at /. */
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/hanabi-taikai/' : '/',
})

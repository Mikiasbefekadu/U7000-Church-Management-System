import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

// createRequire lets us load CJS packages (tailwindcss, autoprefixer) from
// this project's own node_modules inside an ESM config file.
// Inlining PostCSS here means Vite never walks up the directory tree to find
// a postcss.config.js, so the rogue file at C:\Users\zelek\Downloads\ is
// completely ignored.
const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
})

import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  content: {
    filesystem: [
      './src/**/*.{vue,js,ts,jsx,tsx}',
      './index.html',
    ],
  },
  theme: {
    extend: {},
  },
})
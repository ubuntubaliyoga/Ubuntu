import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/pricing/main.ts',
      name: 'PricingEngine',
      formats: ['iife'],
      fileName: () => 'pricing-engine.js'
    },
    outDir: 'js',
    emptyOutDir: false
  }
})

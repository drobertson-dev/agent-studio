import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['node_modules/**', '.nuxt/**', '.output/**', '.agents/**'],
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        // Nuxt specific options
        domEnvironment: 'happy-dom', // 'happy-dom' (default) or 'jsdom'
      },
    },
  },
})

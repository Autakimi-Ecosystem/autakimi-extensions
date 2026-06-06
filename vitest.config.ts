import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      {
        find: /^\.\.\/base\/(.*)/,
        replacement: path.resolve(__dirname, '../packages/sdk/src/engines/sources/$1')
      },
      {
        find: /^\.\.\/types$/,
        replacement: path.resolve(__dirname, '../packages/sdk/src/types')
      },
      {
        find: '@renderer',
        replacement: path.resolve(__dirname, '../apps/desktop/src/renderer/src')
      },
      {
        find: '@common',
        replacement: path.resolve(__dirname, '../packages/sdk/src')
      }
    ]
  }
})

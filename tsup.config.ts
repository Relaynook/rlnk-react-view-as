import { defineConfig } from 'tsup'

// tsup 是 esbuild 包裝,快、產 dual ESM+CJS+.d.ts,適合小型 lib。
// externals 明確列 peer,避免 react/zustand 被 bundle 進 dist (consumer 會撞版本)。
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'zustand'],
  target: 'es2020',
  treeshake: true,
})

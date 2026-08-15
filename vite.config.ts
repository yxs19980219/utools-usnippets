import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 发布版 plugin.json 必须无 development 字段（uTools 规范）
 */
function stripDevelopmentField() {
  return {
    name: 'strip-development-field',
    closeBundle() {
      const p = path.join(process.cwd(), 'dist', 'plugin.json')
      if (!fs.existsSync(p)) return
      const json = JSON.parse(fs.readFileSync(p, 'utf-8'))
      delete json.development
      fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf-8')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripDevelopmentField()],
  base: './',
  server: {
    // 5173 可能被其他项目占用，固定 5175 避免端口冲突
    port: 5175,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    // uTools 3 内核（Chrome 88 级）不支持 oklch()/lab()/color-mix() 等语法，
    // 必须用 Lightning CSS 降级为基础 hex/rgba，否则界面变"线框"
    transformer: 'lightningcss',
    lightningcss: {
      targets: { chrome: 88 },
    },
  },
  build: {
    // uTools 3 内核 Chrome 88：显式 JS 转译目标（一期 CSS 已用 lightningcss chrome88）
    target: 'chrome88',
    // lightningcss minify 对 Tailwind 4 输出有兼容 bug（Invalid empty selector），
    // 关闭 minify 只保留降级转译（产物略大，功能不受影响）
    cssMinify: false,
  },
})

module.exports = {
  content: ["./pages/**/*.{wxml,js}", "./components/**/*.{wxml,js}"],
  theme: {
    extend: {}
  },
  corePlugins: {
    preflight: false // 必须关掉，避免小程序样式冲突
  }
}

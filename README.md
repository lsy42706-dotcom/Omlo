# 简历工坊（Resume Editor）

一个可直接在浏览器中使用的在线简历编辑器，支持多模板切换、实时 A4 预览、证件照上传、多段项目经历以及 Word/PDF 导出。

## 在线体验

[https://jianli-editor.lsy42706.chatgpt.site](https://jianli-editor.lsy42706.chatgpt.site)

首次进入时所有简历内容均为空白。填写的数据只保存在当前浏览器的本地存储中，不需要注册或登录。

## 主要功能

- 三种简历模板：经典简洁、技术专才、现代双栏
- 基本信息、教育经历、项目经历、专业技能和自我评价实时编辑
- 支持添加多段项目经历和多条项目成果
- 模块主题名称、技能分类名称和内容排版可自定义
- 根据内容量自动调整字号与行距，适配 A4 页面
- 上传、更换或移除证件照，并自动裁剪为 4:5
- 保守优化已填写的项目措辞，不补写空白内容、不改变原意
- 支持撤销、重做和模块顺序调整
- 导出完整 PDF 或可继续编辑的 Word 文档
- 自动保存在浏览器本地，无需后端数据库

## 技术栈

- React 19
- Vite 6
- html2canvas + jsPDF
- docx
- Tabler Icons

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

启动后按照终端显示的本地地址在浏览器中打开。

## 构建与测试

```bash
npm run build
npm run test:sites
node --test tests/copy-optimizer.test.mjs
```

生产构建输出位于 `dist/`。

## 项目结构

```text
src/
  App.jsx               主界面、编辑器、预览与导出逻辑
  copyOptimizer.js      保守措辞优化规则
  main.jsx              React 入口
  styles.css            页面、模板与 A4 排版样式
tests/                  功能测试
worker/                 静态站点 Worker 入口
scripts/                构建准备脚本
```

## 数据与隐私

- 简历内容和证件照保存在浏览器 `localStorage` 中。
- PDF 与 Word 文件均在浏览器端生成。
- 本项目不会将简历数据发送到外部服务器。
- 清除浏览器站点数据会删除本地保存的简历，请提前导出文件或简历数据。

## 开源许可

本项目采用 [MIT License](LICENSE) 开源。

const { STORAGE_KEY, TEMPLATES, normalizeState, initialState, visibleSections, plainText } = require("../../utils/resume");

const WEB_URL = "https://jianli-editor.lsy42706.chatgpt.site";

Page({
  data: {
    resume: initialState().resume,
    settings: initialState().settings,
    sections: [], templates: TEMPLATES,
    templateName: "经典简洁", templateClass: "classic",
    hasContent: false
  },
  onShow() {
    let state;
    try {
      const stored = wx.getStorageSync(STORAGE_KEY);
      state = stored ? normalizeState(JSON.parse(stored)) : initialState();
    } catch (_) { state = initialState(); }
    const sections = visibleSections(state);
    const template = TEMPLATES.find((item) => item.id === state.settings.template) || TEMPLATES[0];
    this.setData({ ...state, sections, templateName: template.name, templateClass: template.id, hasContent: Boolean(state.resume.basics.name || sections.length) });
  },
  backToEditor() { wx.navigateBack(); },
  selectTemplate(event) {
    const template = event.currentTarget.dataset.template;
    if (!TEMPLATES.some((item) => item.id === template)) return;
    const settings = { ...this.data.settings, template };
    this.setData({ settings, templateName: TEMPLATES.find((item) => item.id === template).name, templateClass: template });
    try { wx.setStorageSync(STORAGE_KEY, JSON.stringify({ resume: this.data.resume, settings, order: this.data.order })); }
    catch (_) { wx.showToast({ title: "模板保存失败", icon: "none" }); }
  },
  copyText() {
    const data = plainText({ resume: this.data.resume, settings: this.data.settings, order: this.data.order });
    if (!data) return wx.showToast({ title: "请先填写简历", icon: "none" });
    wx.setClipboardData({ data, success: () => wx.showToast({ title: "内容已复制", icon: "success" }), fail: () => wx.showToast({ title: "复制失败", icon: "none" }) });
  },
  copyWebLink() {
    wx.setClipboardData({ data: WEB_URL, success: () => wx.showModal({ title: "继续在网页版导出", content: "链接已复制。请先在小程序的「模板样式」中复制 JSON 备份，再在网页版选择「导入备份」，即可导出 PDF 或 Word。", showCancel: false }) });
  },
  onShareAppMessage() { return { title: "简历工坊 · 认真写好每一段经历", path: "/pages/editor/editor" }; }
});

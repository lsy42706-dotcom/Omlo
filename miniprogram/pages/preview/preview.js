const { userStorageKey, TEMPLATES, normalizeState, initialState, visibleSections, plainText } = require("../../utils/resume");

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
    const account = getApp().globalData.account;
    if (!account || !account.id) { wx.reLaunch({ url: "/pages/login/login" }); return; }
    let state;
    try {
      const stored = wx.getStorageSync(userStorageKey(account.id));
      const cached = stored && JSON.parse(stored);
      state = cached && cached.draftJson ? normalizeState(JSON.parse(cached.draftJson)) : initialState();
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
    try {
      const account = getApp().globalData.account;
      if (!account || !account.id) throw new Error("尚未登录");
      wx.setStorageSync(userStorageKey(account.id), JSON.stringify({ draftJson: JSON.stringify({ resume: this.data.resume, settings, order: this.data.order }), revision: account.revision, pending: true }));
    }
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

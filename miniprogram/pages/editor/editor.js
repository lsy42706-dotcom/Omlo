const {
  STORAGE_KEY, TEMPLATES, emptyEducation, emptyProject, emptySkill,
  initialState, normalizeState, parseBackup, createBackup, completion
} = require("../../utils/resume");

const STEPS = ["基本信息", "教育经历", "项目经历", "专业技能", "模板样式"];
const ACCENTS = ["#2e5bea", "#0f766e", "#7c3aed", "#c2410c"];
const WEB_URL = "https://jianli-editor.lsy42706.chatgpt.site";

Page({
  data: {
    resume: initialState().resume,
    settings: initialState().settings,
    order: initialState().order,
    steps: STEPS,
    templates: TEMPLATES,
    accents: ACCENTS,
    activeStep: 0,
    progress: 0,
    saveStatus: "保存在此设备",
    webUrl: WEB_URL
  },
  onLoad() {
    try {
      const stored = wx.getStorageSync(STORAGE_KEY);
      const state = stored ? normalizeState(JSON.parse(stored)) : initialState();
      this.setData({ ...state, progress: completion(state.resume), saveStatus: stored ? "已恢复本地简历" : "保存在此设备" });
    } catch (_) {
      this.setData({ saveStatus: "读取失败，请先导出备份" });
      wx.showToast({ title: "本地数据读取失败", icon: "none" });
    }
  },
  onHide() { this.persist(); },
  onUnload() { this.persist(); },
  currentState() { return { resume: this.data.resume, settings: this.data.settings, order: this.data.order }; },
  scheduleSave() {
    this.setData({ progress: completion(this.data.resume), saveStatus: "保存中…" });
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 250);
  },
  persist() {
    clearTimeout(this.saveTimer);
    if (!this.data || !this.data.resume) return;
    try {
      wx.setStorageSync(STORAGE_KEY, JSON.stringify(this.currentState()));
      this.setData({ saveStatus: "已保存到此设备" });
    } catch (_) {
      this.setData({ saveStatus: "保存失败，请复制备份" });
    }
  },
  change(path, value) { this.setData({ [path]: value }, () => this.scheduleSave()); },
  onTitleInput(event) { this.change("resume.title", event.detail.value); },
  onBasicInput(event) { this.change(`resume.basics.${event.currentTarget.dataset.field}`, event.detail.value); },
  onEvaluationInput(event) { this.change("resume.selfEvaluation", event.detail.value); },
  onEducationInput(event) { const { index, field } = event.currentTarget.dataset; this.change(`resume.educations[${index}].${field}`, event.detail.value); },
  onProjectInput(event) { const { index, field } = event.currentTarget.dataset; this.change(`resume.projects[${index}].${field}`, event.detail.value); },
  onAchievementInput(event) { const { index, achievement } = event.currentTarget.dataset; this.change(`resume.projects[${index}].achievements[${achievement}]`, event.detail.value); },
  onSkillInput(event) { const { index, field } = event.currentTarget.dataset; this.change(`resume.skillEntries[${index}].${field}`, event.detail.value); },
  selectStep(event) { this.setData({ activeStep: Number(event.currentTarget.dataset.index) }); },
  nextStep() {
    if (this.data.activeStep === STEPS.length - 1) { this.openPreview(); return; }
    this.setData({ activeStep: this.data.activeStep + 1 });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  previousStep() {
    if (this.data.activeStep > 0) this.setData({ activeStep: this.data.activeStep - 1 });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  openPreview() { this.persist(); wx.navigateTo({ url: "/pages/preview/preview" }); },
  addEducation() {
    if (this.data.resume.educations.length >= 50) return wx.showToast({ title: "最多添加 50 段", icon: "none" });
    this.change("resume.educations", [...this.data.resume.educations, emptyEducation()]);
  },
  removeEducation(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.change("resume.educations", this.data.resume.educations.filter((_, i) => i !== index));
  },
  addProject() {
    if (this.data.resume.projects.length >= 100) return wx.showToast({ title: "最多添加 100 段", icon: "none" });
    this.change("resume.projects", [...this.data.resume.projects, emptyProject()]);
  },
  removeProject(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.change("resume.projects", this.data.resume.projects.filter((_, i) => i !== index));
  },
  addAchievement(event) {
    const index = Number(event.currentTarget.dataset.index);
    const projects = this.data.resume.projects.slice();
    const project = { ...projects[index] };
    if (project.achievements.length >= 100) return wx.showToast({ title: "成果条目已达上限", icon: "none" });
    project.achievements = [...project.achievements, ""];
    projects[index] = project;
    this.change("resume.projects", projects);
  },
  removeAchievement(event) {
    const index = Number(event.currentTarget.dataset.index);
    const achievement = Number(event.currentTarget.dataset.achievement);
    const projects = this.data.resume.projects.slice();
    const project = { ...projects[index] };
    project.achievements = project.achievements.filter((_, i) => i !== achievement);
    projects[index] = project;
    this.change("resume.projects", projects);
  },
  addSkill() {
    if (this.data.resume.skillEntries.length >= 100) return wx.showToast({ title: "最多添加 100 类", icon: "none" });
    this.change("resume.skillEntries", [...this.data.resume.skillEntries, emptySkill()]);
  },
  removeSkill(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.change("resume.skillEntries", this.data.resume.skillEntries.filter((_, i) => i !== index));
  },
  selectTemplate(event) { this.change("settings.template", event.currentTarget.dataset.template); },
  selectAccent(event) { this.change("settings.accent", event.currentTarget.dataset.color); },
  selectSpacing(event) { this.change("settings.spacing", event.currentTarget.dataset.spacing); },
  toggleEmpty(event) { this.change("settings.hideEmptySections", event.detail.value); },
  copyBackup() {
    const backup = createBackup(this.currentState());
    wx.setClipboardData({ data: backup, success: () => wx.showToast({ title: "备份已复制", icon: "success" }), fail: () => wx.showToast({ title: "复制失败", icon: "none" }) });
  },
  importBackup() {
    wx.getClipboardData({
      success: ({ data }) => {
        let state;
        try { state = parseBackup(data); }
        catch (error) { wx.showModal({ title: "无法导入", content: error.message, showCancel: false }); return; }
        wx.showModal({ title: "导入简历备份", content: "将替换当前简历内容与模板设置。确定导入吗？", success: ({ confirm }) => {
          if (!confirm) return;
          this.setData({ ...state, progress: completion(state.resume), activeStep: 0 }, () => this.persist());
          wx.showToast({ title: "已导入备份", icon: "success" });
        } });
      },
      fail: () => wx.showToast({ title: "读取剪贴板失败", icon: "none" })
    });
  },
  clearResume() {
    wx.showModal({ title: "清空简历", content: "当前设备上的简历内容将被清空。建议先复制备份。", confirmColor: "#ba3d35", success: ({ confirm }) => {
      if (!confirm) return;
      const state = initialState();
      this.setData({ ...state, progress: 0, activeStep: 0 }, () => this.persist());
    } });
  }
});

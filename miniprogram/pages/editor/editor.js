const {
  userStorageKey, TEMPLATES, emptyEducation, emptyProject, emptySkill,
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
    saveStatus: "登录后同步到云端",
    localOnly: false,
    hasLocalBackup: false,
    webUrl: WEB_URL
  },
  onLoad() {
    const account = getApp().globalData.account;
    if (!account || !account.id) { wx.reLaunch({ url: "/pages/login/login" }); return; }
    this.accountId = account.id;
    this.localOnly = Boolean(account.localOnly);
    this.revision = account.revision || 0;
    try {
      const draftJson = getApp().globalData.initialDraft;
      const state = draftJson ? parseBackup(draftJson) : initialState();
      this.lastSyncedJson = account.serverDraft ? JSON.stringify(parseBackup(account.serverDraft)) : draftJson ? null : JSON.stringify(state);
      const hasLocalBackup = Boolean(wx.getStorageSync(`${userStorageKey(this.accountId)}:backup`));
      this.setData({ ...state, progress: completion(state.resume), hasLocalBackup, localOnly: this.localOnly, saveStatus: this.localOnly ? "仅本机试用" : draftJson ? "草稿已载入" : "已登录，开始填写吧" });
      this.hasLoaded = true;
      if (!this.localOnly && JSON.stringify(state) !== this.lastSyncedJson) this.scheduleSave();
    } catch (_) {
      this.setData({ saveStatus: "草稿读取失败，请从登录页重试" });
      wx.showToast({ title: "草稿读取失败", icon: "none" });
    }
  },
  onShow() {
    if (!this.hasLoaded || !this.accountId) return;
    try {
      const cached = wx.getStorageSync(userStorageKey(this.accountId));
      const local = cached && JSON.parse(cached);
      if (local && local.pending && local.draftJson && local.draftJson !== JSON.stringify(this.currentState())) {
        const state = parseBackup(local.draftJson);
        this.setData({ ...state, progress: completion(state.resume) }, () => this.scheduleSave());
      }
    } catch (_) { /* Keep the current editor state when the local cache is unreadable. */ }
  },
  onHide() { this.persist(); },
  onUnload() { clearTimeout(this.saveTimer); clearTimeout(this.cloudTimer); if (!this.skipPersist) this.persist(); },
  currentState() { return { resume: this.data.resume, settings: this.data.settings, order: this.data.order }; },
  scheduleSave() {
    this.setData({ progress: completion(this.data.resume), saveStatus: "保存中…" });
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 250);
  },
  persist() {
    clearTimeout(this.saveTimer);
    if (!this.hasLoaded || !this.accountId || !this.data || !this.data.resume) return;
    const draftJson = JSON.stringify(this.currentState());
    try {
      wx.setStorageSync(userStorageKey(this.accountId), JSON.stringify({ draftJson, revision: this.revision, pending: !this.localOnly && draftJson !== this.lastSyncedJson }));
      if (this.localOnly) { this.setData({ saveStatus: "仅本机保存" }); return; }
      if (draftJson === this.lastSyncedJson) this.setData({ saveStatus: "已同步到云端" });
      else { this.setData({ saveStatus: this.conflict ? "其他设备更新了草稿" : "本机已保存，云端待同步" }); this.scheduleCloudSync(); }
    } catch (_) {
      this.setData({ saveStatus: "保存失败，请复制备份" });
    }
  },
  scheduleCloudSync() {
    if (this.localOnly || this.conflict) return;
    clearTimeout(this.cloudTimer);
    this.cloudTimer = setTimeout(() => this.syncCloud(), 900);
  },
  async syncCloud() {
    if (this.localOnly || !this.accountId || this.conflict) return;
    if (!getApp().globalData.account || getApp().globalData.account.id !== this.accountId) return;
    if (this.syncInFlight) { this.syncAgain = true; return; }
    const draftJson = JSON.stringify(this.currentState());
    if (draftJson === this.lastSyncedJson) return;
    this.syncInFlight = true;
    this.setData({ saveStatus: "正在同步云端…" });
    try {
      const response = await wx.cloud.callFunction({ name: "resumeAccount", data: { action: "save", draftJson, revision: this.revision } });
      if (!getApp().globalData.account || getApp().globalData.account.id !== this.accountId) return;
      const result = response.result;
      if (!result || !result.ok) {
        if (result && result.code === "CONFLICT") { this.conflict = result; this.setData({ saveStatus: "其他设备更新了草稿" }); return; }
        this.setData({ saveStatus: result && result.code === "DRAFT_TOO_LARGE" ? "草稿过大，无法云端保存" : "本机已保存，云端同步失败" });
        return;
      }
      this.revision = result.revision;
      getApp().globalData.account.revision = result.revision;
      this.lastSyncedJson = draftJson;
      const pending = JSON.stringify(this.currentState()) !== draftJson;
      wx.setStorageSync(userStorageKey(this.accountId), JSON.stringify({ draftJson: JSON.stringify(this.currentState()), revision: this.revision, pending }));
      this.setData({ saveStatus: pending ? "本机已保存，云端待同步" : "已同步到云端" });
      if (pending) this.syncAgain = true;
    } catch (_) { this.setData({ saveStatus: "本机已保存，云端同步失败" }); }
    finally {
      this.syncInFlight = false;
      if (this.syncAgain && getApp().globalData.account && getApp().globalData.account.id === this.accountId) { this.syncAgain = false; this.scheduleCloudSync(); }
    }
  },
  retryCloud() { if (this.conflict) this.resolveConflict(); else this.syncCloud(); },
  resolveConflict() {
    wx.showActionSheet({ itemList: ["使用云端版本", "用本机版本覆盖云端"], success: async ({ tapIndex }) => {
      if (tapIndex === 0) {
        try {
          const state = this.conflict.draftJson ? parseBackup(this.conflict.draftJson) : initialState();
          wx.setStorageSync(`${userStorageKey(this.accountId)}:backup`, JSON.stringify({ draftJson: JSON.stringify(this.currentState()), revision: this.revision, pending: true }));
          this.revision = this.conflict.revision || 0;
          this.lastSyncedJson = JSON.stringify(state);
          this.conflict = null;
          this.setData({ ...state, progress: completion(state.resume), hasLocalBackup: true, saveStatus: "已使用云端版本" }, () => this.persist());
        } catch (_) { wx.showToast({ title: "云端草稿读取失败", icon: "none" }); }
        return;
      }
      const accepted = await new Promise((resolve) => wx.showModal({ title: "覆盖云端草稿？", content: "本机内容将替换同一账号在其他设备保存的版本。", confirmText: "确认覆盖", success: ({ confirm }) => resolve(confirm), fail: () => resolve(false) }));
      if (!accepted) return;
      try {
        const draftJson = JSON.stringify(this.currentState());
        const response = await wx.cloud.callFunction({ name: "resumeAccount", data: { action: "forceSave", draftJson } });
        if (!response.result || !response.result.ok) throw new Error("保存失败");
        this.revision = response.result.revision;
        this.lastSyncedJson = draftJson;
        this.conflict = null;
        this.persist();
      } catch (_) { this.setData({ saveStatus: "云端覆盖失败，本机草稿仍保留" }); }
    } });
  },
  logout() {
    const pending = !this.localOnly && JSON.stringify(this.currentState()) !== this.lastSyncedJson;
    wx.showModal({ title: this.localOnly ? "结束本机试用？" : "退出当前账号？", content: this.localOnly ? "本机草稿会保留，下次试用可继续编辑。" : pending ? "本机还有未同步的编辑。退出后本机草稿会保留，下次登录可恢复。" : "再次进入时需要重新登录。", success: ({ confirm }) => {
      if (!confirm) return;
      this.persist();
      this.skipPersist = true;
      clearTimeout(this.saveTimer);
      clearTimeout(this.cloudTimer);
      getApp().globalData.account = null;
      getApp().globalData.initialDraft = null;
      wx.reLaunch({ url: "/pages/login/login" });
    } });
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
  restoreLocalBackup() {
    try {
      const saved = wx.getStorageSync(`${userStorageKey(this.accountId)}:backup`);
      const backup = saved && JSON.parse(saved);
      const state = backup && parseBackup(backup.draftJson);
      if (!state) throw new Error("本机备份不存在");
      wx.showModal({ title: "恢复本机备份？", content: "这会替换当前编辑内容，之后同步到当前微信账号。", success: ({ confirm }) => {
        if (!confirm) return;
        this.setData({ ...state, progress: completion(state.resume), activeStep: 0 }, () => this.persist());
      } });
    } catch (_) { wx.showToast({ title: "本机备份读取失败", icon: "none" }); }
  },
  clearResume() {
    wx.showModal({ title: "清空简历", content: this.localOnly ? "将清空本机试用草稿。建议先复制备份。" : "将清空当前账号的草稿，并同步到云端。建议先复制备份。", confirmColor: "#ba3d35", success: ({ confirm }) => {
      if (!confirm) return;
      const state = initialState();
      this.setData({ ...state, progress: 0, activeStep: 0 }, () => this.persist());
    } });
  }
});

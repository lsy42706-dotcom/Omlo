const { STORAGE_KEY, LOCAL_ACCOUNT_ID, userStorageKey, parseBackup } = require("../../utils/resume");

function modal(options) {
  return new Promise((resolve) => wx.showModal({ ...options, success: resolve, fail: () => resolve({ failed: true }) }));
}

Page({
  data: { busy: false, configured: false, error: "" },
  onLoad() { this.setData({ configured: Boolean(getApp().globalData.cloudReady && wx.cloud) }); },
  startLocal() {
    try {
      const saved = wx.getStorageSync(userStorageKey(LOCAL_ACCOUNT_ID));
      const cached = saved && JSON.parse(saved);
      const draftJson = cached && cached.draftJson || null;
      if (draftJson) parseBackup(draftJson);
      getApp().globalData.account = { id: LOCAL_ACCOUNT_ID, revision: 0, serverDraft: null, localOnly: true };
      getApp().globalData.initialDraft = draftJson;
      wx.redirectTo({ url: "/pages/editor/editor" });
    } catch (_) { this.setData({ error: "本机试用草稿读取失败。请先保留设备数据，再尝试恢复。" }); }
  },
  async signIn() {
    if (this.data.busy) return;
    if (!getApp().globalData.cloudReady || !wx.cloud) {
      this.setData({ error: "请先在项目中配置微信小程序 AppID 和云开发环境 ID。" });
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      const response = await wx.cloud.callFunction({ name: "resumeAccount", data: { action: "login" } });
      let result = response.result;
      if (!result || !result.ok || !result.accountId) throw new Error("云端登录未成功，请检查云函数和数据库配置。");
      let draftJson = result.draftJson || null;
      let revision = result.revision || 0;
      const cached = wx.getStorageSync(userStorageKey(result.accountId));
      if (cached) {
        let local = null;
        try {
          local = JSON.parse(cached);
          if (local.pending && typeof local.draftJson === "string") parseBackup(local.draftJson);
        } catch (_) { local = null; /* Corrupt cache is left untouched for recovery. */ }
        if (local && local.pending && typeof local.draftJson === "string") {
          const decision = await modal({ title: "发现未同步的本机草稿", content: "要继续编辑本机内容吗？选“使用云端”会将本机版本另存为备份，可在模板样式中恢复。", confirmText: "继续本机", cancelText: "使用云端" });
          if (decision.failed) throw new Error("无法确认草稿版本，请重新登录。本机草稿未删除。");
          if (decision.confirm) { draftJson = local.draftJson; revision = Number.isInteger(local.revision) ? local.revision : revision; }
          else {
            wx.setStorageSync(`${userStorageKey(result.accountId)}:backup`, cached);
            wx.removeStorageSync(userStorageKey(result.accountId));
          }
        }
      }
      if (!result.draftJson && !draftJson) {
        const trial = wx.getStorageSync(userStorageKey(LOCAL_ACCOUNT_ID));
        let trialDraft = null;
        try { trialDraft = trial && JSON.parse(trial).draftJson; if (trialDraft) parseBackup(trialDraft); }
        catch (_) { trialDraft = null; }
        if (trialDraft) {
          const choice = await modal({ title: "导入本机试用草稿？", content: "检测到本机试用时填写的简历。导入后将保存到当前微信账号。", confirmText: "导入草稿", cancelText: "暂不导入" });
          if (choice.failed) throw new Error("无法确认是否导入本机试用草稿，请重新登录。");
          if (choice.confirm) { draftJson = trialDraft; revision = 0; }
        }
      }
      if (!result.draftJson && !draftJson) {
        const legacy = wx.getStorageSync(STORAGE_KEY);
        if (legacy) {
          let validLegacy = false;
          try { parseBackup(legacy); validLegacy = true; }
          catch (_) { /* A malformed legacy value must not replace the account draft. */ }
          if (validLegacy) {
            const choice = await modal({ title: "导入旧版本机草稿？", content: "检测到登录前保存的简历。确认后会将它保存到当前微信账号。", confirmText: "导入草稿", cancelText: "暂不导入" });
            if (choice.failed) throw new Error("无法确认是否导入旧草稿，请重新登录。");
            if (choice.confirm) { draftJson = legacy; revision = 0; }
          }
        }
      }
      getApp().globalData.account = { id: result.accountId, revision, serverDraft: result.draftJson || null };
      getApp().globalData.initialDraft = draftJson;
      wx.redirectTo({ url: "/pages/editor/editor" });
    } catch (error) {
      this.setData({ error: error && error.message || "登录失败，请稍后重试。" });
    } finally { this.setData({ busy: false }); }
  }
});

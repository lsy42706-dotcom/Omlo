const { envId } = require("./config/cloud");

App({
  globalData: { cloudReady: false, account: null, initialDraft: null },
  onLaunch() {
    if (!envId || !wx.cloud) return;
    try {
      wx.cloud.init({ env: envId, traceUser: false });
      this.globalData.cloudReady = true;
    } catch (_) { this.globalData.cloudReady = false; }
  }
});

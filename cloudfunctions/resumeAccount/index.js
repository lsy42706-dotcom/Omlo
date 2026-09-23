const cloud = require("wx-server-sdk");
const { handle } = require("./service");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// Deploy as a Mini Program event function only; do not add an HTTP trigger.
exports.main = async (event) => {
  const context = cloud.getWXContext();
  if (!context.OPENID || !context.APPID) return { ok: false, code: "UNAUTHENTICATED" };
  try {
    const db = cloud.database({ env: cloud.DYNAMIC_CURRENT_ENV });
    return await handle({ event, openid: context.OPENID, db });
  } catch (_) {
    return { ok: false, code: "SERVER_ERROR" };
  }
};

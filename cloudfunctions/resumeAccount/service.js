const COLLECTION = "resume_drafts";
const MAX_DRAFT_BYTES = 700 * 1024;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function validateTextFields(record, fields) {
  if (!isRecord(record)) throw new Error("INVALID_DRAFT");
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && (typeof value !== "string" || value.length > 20000)) throw new Error("INVALID_DRAFT");
  }
}

function validateDraft(draftJson) {
  if (typeof draftJson !== "string" || Buffer.byteLength(draftJson, "utf8") > MAX_DRAFT_BYTES) throw new Error("DRAFT_TOO_LARGE");
  let data;
  try { data = JSON.parse(draftJson); } catch (_) { throw new Error("INVALID_DRAFT"); }
  if (!isRecord(data) || !isRecord(data.resume) || data.version !== undefined && data.version !== 1) throw new Error("INVALID_DRAFT");
  const resume = data.resume;
  validateTextFields(resume, ["title", "selfEvaluation"]);
  validateTextFields(resume.basics, ["name", "jobTitle", "phone", "email", "location", "summary"]);
  const photo = resume.basics.photo;
  if (photo != null && (typeof photo !== "string" || photo.length > 500000 || !/^data:image\/(png|jpeg);base64,[a-z\d+/=\s]+$/i.test(photo))) throw new Error("INVALID_DRAFT");
  for (const [key, fields, limit] of [
    ["educations", ["id", "school", "major", "degree", "startDate", "endDate", "location"], 50],
    ["projects", ["id", "name", "role", "startDate", "endDate", "description"], 100],
    ["skillEntries", ["id", "label", "value"], 100]
  ]) {
    const entries = resume[key];
    if (!Array.isArray(entries) || entries.length > limit) throw new Error("INVALID_DRAFT");
    for (const entry of entries) {
      validateTextFields(entry, fields);
      if (key === "projects" && (entry.achievements !== undefined && (!Array.isArray(entry.achievements) || entry.achievements.length > 100 || entry.achievements.some((item) => typeof item !== "string" || item.length > 20000)))) throw new Error("INVALID_DRAFT");
    }
  }
  if (!isRecord(data.settings) || !Array.isArray(data.order) || data.order.length > 5) throw new Error("INVALID_DRAFT");
  return data;
}

async function findDraft(collection, openid) {
  const response = await collection.where({ _id: openid }).limit(1).get();
  return response.data && response.data[0] || null;
}

function publicDraft(record) {
  return { draftJson: record && record.draftJson || null, revision: record && record.revision || 0, savedAt: record && record.savedAt || null };
}

async function handle({ event, openid, db }) {
  if (typeof openid !== "string" || !openid || !isRecord(event)) return { ok: false, code: "UNAUTHENTICATED" };
  if (!["login", "save", "forceSave"].includes(event.action)) return { ok: false, code: "UNKNOWN_ACTION" };
  const collection = db.collection(COLLECTION);
  if (event.action === "login") {
    const record = await findDraft(collection, openid);
    return { ok: true, accountId: openid, ...publicDraft(record) };
  }
  try { validateDraft(event.draftJson); }
  catch (error) { return { ok: false, code: error.message === "DRAFT_TOO_LARGE" ? "DRAFT_TOO_LARGE" : "INVALID_DRAFT" }; }

  const current = await findDraft(collection, openid);
  if (event.action === "forceSave") {
    const revision = (current && current.revision || 0) + 1;
    const savedAt = new Date().toISOString();
    await collection.doc(openid).set({ data: { draftJson: event.draftJson, revision, savedAt } });
    return { ok: true, revision, savedAt };
  }
  const expected = event.revision;
  if (!Number.isInteger(expected) || expected < 0) return { ok: false, code: "INVALID_REVISION" };
  if ((current && current.revision || 0) !== expected) return { ok: false, code: "CONFLICT", ...publicDraft(current) };
  const revision = expected + 1;
  const savedAt = new Date().toISOString();
  if (!current) {
    try { await collection.add({ data: { _id: openid, draftJson: event.draftJson, revision, savedAt } }); }
    catch (_) { return { ok: false, code: "CONFLICT", ...publicDraft(await findDraft(collection, openid)) }; }
  } else {
    const updated = await collection.where({ _id: openid, revision: expected }).update({ data: { draftJson: event.draftJson, revision, savedAt } });
    if (!updated.stats || updated.stats.updated !== 1) return { ok: false, code: "CONFLICT", ...publicDraft(await findDraft(collection, openid)) };
  }
  return { ok: true, revision, savedAt };
}

module.exports = { handle, validateDraft, MAX_DRAFT_BYTES };

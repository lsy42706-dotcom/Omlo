export const STORAGE_KEY = "resume-workshop-state";
export const SECTION_ORDER = ["基本信息", "教育经历", "项目经历", "技能", "自我评价"];
export const hasText = (value) => typeof value === "string" && value.trim().length > 0;
export const hasProjectContent = (project) => [project.name, project.role, project.description, project.startDate, project.endDate, ...(project.achievements || [])].some(hasText);
export const normalizeOrder = (value) => [...new Set([...(Array.isArray(value) ? value.filter((key) => SECTION_ORDER.includes(key)) : []), ...SECTION_ORDER])];

export function sectionHasContent(key, resume) {
  if (key === "基本信息") return hasText(resume.basics.summary);
  if (key === "教育经历") return Object.values(resume.education).some(hasText);
  if (key === "项目经历") return resume.projects.some(hasProjectContent);
  if (key === "技能") return Object.values(resume.skills).some(hasText);
  if (key === "自我评价") return hasText(resume.selfEvaluation);
  return false;
}

export function resumeCompletion(resume) {
  const groups = [
    [hasText(resume.basics.name), hasText(resume.basics.jobTitle), [resume.basics.phone, resume.basics.email].some(hasText)],
    [resume.education.school, resume.education.major].map(hasText),
    [resume.projects.some((project) => hasText(project.name) && hasText(project.description))],
    [Object.values(resume.skills).some(hasText)],
  ];
  const checks = groups.flat();
  return { percent: Math.round(checks.filter(Boolean).length / checks.length * 100), steps: groups.map((group) => group.every(Boolean)) };
}

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const invalid = () => { throw new Error("文件内容不符合简历备份格式，请选择从简历工坊导出的 JSON 文件。"); };
function textFields(record, keys) {
  if (record === undefined) return;
  if (!isRecord(record)) invalid();
  for (const key of keys) if (record[key] !== undefined && (typeof record[key] !== "string" || record[key].length > 20000)) invalid();
}

// Validate before applying imported or browser-persisted data. Never fetch photos from backups.
export function parseResumeBackup(text) {
  if (typeof text !== "string" || text.length > 8 * 1024 * 1024) throw new Error("备份文件不能超过 8 MB。");
  let state;
  try { state = JSON.parse(text); } catch { invalid(); }
  if (!isRecord(state) || !isRecord(state.resume) || (state.version !== undefined && state.version !== 1)) invalid();
  const r = state.resume;
  textFields(r, ["title", "selfEvaluation"]);
  textFields(r.basics, ["name", "jobTitle", "phone", "email", "location", "summary"]);
  textFields(r.education, ["school", "major", "degree", "startDate", "endDate", "location"]);
  textFields(r.skills, ["languages", "embedded", "protocols", "tools"]);
  textFields(r.skillLabels, ["languages", "embedded", "protocols", "tools"]);
  textFields(r.sectionTitles, SECTION_ORDER);
  if (r.basics?.photo != null && (typeof r.basics.photo !== "string" || !/^data:image\/(png|jpeg);base64,[a-z\d+/=\s]+$/i.test(r.basics.photo))) invalid();
  if (r.projects !== undefined && (!Array.isArray(r.projects) || r.projects.length > 100)) invalid();
  for (const project of r.projects || (r.project ? [r.project] : [])) {
    if (!isRecord(project)) invalid();
    textFields(project, ["id", "name", "role", "startDate", "endDate", "description"]);
    if (project.achievements !== undefined && (!Array.isArray(project.achievements) || project.achievements.length > 100 || project.achievements.some((value) => typeof value !== "string" || value.length > 20000))) invalid();
  }
  if (state.settings !== undefined && !isRecord(state.settings)) invalid();
  const settings = { ...(state.settings || {}) };
  if (!["classic", "tech", "modern"].includes(settings.template)) delete settings.template;
  if (!["compact", "standard", "comfortable"].includes(settings.spacing)) delete settings.spacing;
  if (!/^#[a-f\d]{6}$/i.test(settings.accent || "")) delete settings.accent;
  for (const key of ["showPhoto", "pageBorder", "hideEmptySections"]) if (typeof settings[key] !== "boolean") delete settings[key];
  const layouts = { 基本信息: ["bullets", "columns", "paragraph"], 教育经历: ["timeline", "card", "compact"], 项目经历: ["structured", "bullets", "card"], 技能: ["groups", "tags", "columns"], 自我评价: ["bullets", "columns", "paragraph"] };
  settings.moduleLayouts = Object.fromEntries(Object.entries(isRecord(settings.moduleLayouts) ? settings.moduleLayouts : {}).filter(([key, value]) => layouts[key]?.includes(value)));
  return { resume: r, settings, order: normalizeOrder(state.order) };
}

export function readStoredResume(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    return { state: text ? parseResumeBackup(text) : null, error: "" };
  } catch {
    return { state: null, error: "无法读取本地简历。原有存储未被覆盖；可导入备份或开始编辑新简历。" };
  }
}

export function saveResume(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export const createBackup = (state) => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);

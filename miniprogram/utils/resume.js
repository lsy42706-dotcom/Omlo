const STORAGE_KEY = "resume-workshop-state";
const LOCAL_ACCOUNT_ID = "local-demo";
const userStorageKey = (accountId) => `${STORAGE_KEY}:user:${accountId}`;
const ORDER = ["基本信息", "教育经历", "项目经历", "技能", "自我评价"];
const TEMPLATES = [
  { id: "classic", name: "经典简洁", note: "清晰稳妥" },
  { id: "tech", name: "技术专才", note: "突出能力" },
  { id: "modern", name: "现代双栏", note: "信息分明" },
  { id: "minimal", name: "极简留白", note: "留白舒展" },
  { id: "academic", name: "学术履历", note: "正式稳重" }
];
const DEFAULT_SKILLS = [
  ["languages", "编程语言"], ["embedded", "嵌入式开发"],
  ["protocols", "通信协议"], ["tools", "开发工具"]
];
const text = (value) => typeof value === "string" ? value : "";
const filled = (value) => text(value).trim().length > 0;
const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const plainFields = (source, keys) => Object.fromEntries(keys.map((key) => [key, text(source && source[key])]));

function emptyEducation() {
  return { id: newId("education"), school: "", major: "", degree: "", startDate: "", endDate: "", location: "" };
}
function emptyProject() {
  return { id: newId("project"), name: "", role: "", startDate: "", endDate: "", description: "", achievements: [""] };
}
function emptySkill() { return { id: newId("skill"), label: "", value: "" }; }
function initialState() {
  return {
    resume: {
      title: "", sectionTitles: { 基本信息: "个人简介", 教育经历: "教育经历", 项目经历: "项目经历", 技能: "专业技能", 自我评价: "自我评价" },
      basics: { name: "", jobTitle: "", phone: "", email: "", location: "", photo: null, summary: "" },
      educations: [emptyEducation()], projects: [emptyProject()],
      skillEntries: DEFAULT_SKILLS.map(([key, label]) => ({ id: `skill-${key}`, label, value: "" })),
      selfEvaluation: ""
    },
    settings: { template: "classic", accent: "#2e5bea", spacing: "standard", showPhoto: false, pageBorder: true, hideEmptySections: true, moduleLayouts: {} },
    order: ORDER.slice()
  };
}
function normalizeState(value) {
  const base = initialState();
  const raw = value && value.resume && typeof value.resume === "object" ? value.resume : {};
  const basics = raw.basics && typeof raw.basics === "object" ? raw.basics : {};
  const educationSource = Array.isArray(raw.educations) ? raw.educations : raw.education ? [raw.education] : base.resume.educations;
  const projectSource = Array.isArray(raw.projects) ? raw.projects : raw.project ? [raw.project] : base.resume.projects;
  const skillSource = Array.isArray(raw.skillEntries) ? raw.skillEntries : DEFAULT_SKILLS.map(([key, label]) => ({ label: raw.skillLabels && raw.skillLabels[key] || label, value: raw.skills && raw.skills[key] || "" }));
  const settings = value && value.settings && typeof value.settings === "object" ? value.settings : {};
  return {
    resume: {
      title: text(raw.title),
      sectionTitles: { ...base.resume.sectionTitles, ...(raw.sectionTitles || {}) },
      basics: { ...plainFields(basics, ["name", "jobTitle", "phone", "email", "location", "summary"]), photo: /^data:image\/(png|jpeg);base64,/i.test(basics.photo || "") ? basics.photo : null },
      educations: educationSource.slice(0, 50).map((entry) => ({ id: text(entry.id) || newId("education"), ...plainFields(entry, ["school", "major", "degree", "startDate", "endDate", "location"]) })),
      projects: projectSource.slice(0, 100).map((entry) => ({ id: text(entry.id) || newId("project"), ...plainFields(entry, ["name", "role", "startDate", "endDate", "description"]), achievements: Array.isArray(entry.achievements) ? entry.achievements.slice(0, 100).map(text) : [""] })),
      skillEntries: skillSource.slice(0, 100).map((entry) => ({ id: text(entry.id) || newId("skill"), label: text(entry.label), value: text(entry.value) })),
      selfEvaluation: text(raw.selfEvaluation)
    },
    settings: {
      ...base.settings,
      template: TEMPLATES.some((item) => item.id === settings.template) ? settings.template : "classic",
      accent: /^#[0-9a-f]{6}$/i.test(settings.accent || "") ? settings.accent : base.settings.accent,
      spacing: ["compact", "standard", "comfortable"].includes(settings.spacing) ? settings.spacing : "standard",
      showPhoto: settings.showPhoto === true,
      pageBorder: settings.pageBorder !== false,
      hideEmptySections: settings.hideEmptySections !== false,
      moduleLayouts: settings.moduleLayouts && typeof settings.moduleLayouts === "object" ? settings.moduleLayouts : {}
    },
    order: [...new Set([...(Array.isArray(value && value.order) ? value.order.filter((item) => ORDER.includes(item)) : []), ...ORDER])]
  };
}
function validateBackup(source) {
  if (!source || typeof source !== "object" || Array.isArray(source) || !source.resume || typeof source.resume !== "object" || Array.isArray(source.resume) || source.version !== undefined && source.version !== 1) throw new Error("剪贴板不是简历工坊的 JSON 备份");
  const resume = source.resume;
  if (resume.educations !== undefined && (!Array.isArray(resume.educations) || resume.educations.length > 50)) throw new Error("教育经历数据不符合格式");
  if (resume.projects !== undefined && (!Array.isArray(resume.projects) || resume.projects.length > 100)) throw new Error("项目经历数据不符合格式");
  if (resume.skillEntries !== undefined && (!Array.isArray(resume.skillEntries) || resume.skillEntries.length > 100)) throw new Error("技能数据不符合格式");
  const photo = resume.basics && resume.basics.photo;
  if (photo != null && (typeof photo !== "string" || !/^data:image\/(png|jpeg);base64,[a-z\d+/=\s]+$/i.test(photo))) throw new Error("照片必须是内嵌 JPG 或 PNG");
  const collections = [resume.educations || [], resume.projects || [], resume.skillEntries || []];
  for (const collection of collections) for (const entry of collection) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("备份条目不符合格式");
    for (const value of Object.values(entry)) if (typeof value === "string" && value.length > 20000) throw new Error("备份字段过长");
  }
}
function parseBackup(serialized) {
  if (typeof serialized !== "string" || serialized.length > 8 * 1024 * 1024) throw new Error("备份文件不能超过 8 MB");
  let source;
  try { source = JSON.parse(serialized); } catch { throw new Error("剪贴板不是有效的 JSON"); }
  validateBackup(source);
  return normalizeState(source);
}
function createBackup(state) { return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2); }
function completion(resume) {
  const checks = [filled(resume.basics.name), filled(resume.basics.jobTitle), filled(resume.basics.phone) || filled(resume.basics.email), resume.educations.some((item) => filled(item.school) && filled(item.major)), resume.projects.some((item) => filled(item.name) && filled(item.description)), resume.skillEntries.some((item) => filled(item.value))];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
function points(value) { return text(value).split(/[\n；;。]+/).map((item) => item.trim()).filter(Boolean); }
function visibleSections(state) {
  const { resume, settings, order } = state;
  const sections = {
    基本信息: { type: "summary", title: resume.sectionTitles.基本信息, points: points(resume.basics.summary), hasContent: filled(resume.basics.summary) },
    教育经历: { type: "education", title: resume.sectionTitles.教育经历, entries: resume.educations.filter((item) => !settings.hideEmptySections || [item.school, item.major, item.degree, item.startDate, item.endDate, item.location].some(filled)), hasContent: resume.educations.some((item) => [item.school, item.major, item.degree, item.startDate, item.endDate, item.location].some(filled)) },
    项目经历: { type: "project", title: resume.sectionTitles.项目经历, entries: resume.projects.filter((item) => !settings.hideEmptySections || [item.name, item.role, item.description, ...item.achievements].some(filled)).map((item) => ({ ...item, bullets: [...points(item.description), ...item.achievements.filter(filled)] })), hasContent: resume.projects.some((item) => [item.name, item.role, item.description, ...item.achievements].some(filled)) },
    技能: { type: "skills", title: resume.sectionTitles.技能, entries: resume.skillEntries.filter((item) => !settings.hideEmptySections || filled(item.value)).map((item) => ({ ...item, tags: text(item.value).split(/[,，、;；]+/).map((tag) => tag.trim()).filter(Boolean) })), hasContent: resume.skillEntries.some((item) => filled(item.value)) },
    自我评价: { type: "evaluation", title: resume.sectionTitles.自我评价, points: points(resume.selfEvaluation), hasContent: filled(resume.selfEvaluation) }
  };
  return order.map((key) => sections[key]).filter((item) => item && (!settings.hideEmptySections || item.hasContent));
}
function plainText(state) {
  const { resume } = state;
  const lines = [resume.basics.name || "我的简历", resume.basics.jobTitle, [resume.basics.phone, resume.basics.email, resume.basics.location].filter(filled).join(" · ")].filter(filled);
  for (const section of visibleSections(state)) {
    lines.push("", section.title);
    if (section.points) lines.push(...section.points.map((item) => `• ${item}`));
    if (section.type === "education") for (const item of section.entries) lines.push([item.school, item.major, item.degree, [item.startDate, item.endDate].filter(filled).join("—")].filter(filled).join(" · "));
    if (section.type === "project") for (const item of section.entries) lines.push([item.name, item.role, [item.startDate, item.endDate].filter(filled).join("—")].filter(filled).join(" · "), ...item.bullets.map((bullet) => `• ${bullet}`));
    if (section.type === "skills") for (const item of section.entries) lines.push(`${item.label || "技能"}：${item.value}`);
  }
  return lines.join("\n").trim();
}
module.exports = { STORAGE_KEY, LOCAL_ACCOUNT_ID, userStorageKey, ORDER, TEMPLATES, emptyEducation, emptyProject, emptySkill, initialState, normalizeState, parseBackup, createBackup, completion, visibleSections, plainText };

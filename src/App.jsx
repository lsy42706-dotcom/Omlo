import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowLeft as ArrowLeft, IconArrowRight as ArrowRight, IconBriefcase as BriefcaseBusiness,
  IconCalendar as CalendarDays, IconCheck as Check, IconChevronDown as ChevronDown,
  IconCircleCheck as CircleCheck, IconDownload as Download, IconFileText as FileText,
  IconGripVertical as GripVertical, IconPhoto as ImageIcon, IconMail as Mail,
  IconMapPin as MapPin, IconDots as MoreHorizontal, IconPencil as Pencil,
  IconPhone as Phone, IconPlus as Plus, IconArrowForwardUp as Redo2,
  IconSettings as Settings2, IconSparkles as Sparkles, IconTrash as Trash2,
  IconArrowBackUp as Undo2, IconUser as UserRound,
} from "@tabler/icons-react";
import { optimizeProjectCopy, projectHasOptimizableContent } from "./copyOptimizer.js";
import { normalizeOrder, hasText, hasProjectContent, hasEducationContent, hasInternshipContent, hasPublicationContent, hasAwardContent, sectionHasContent, resumeCompletion, parseResumeBackup, readStoredResume, saveResume, createBackup, normalizeResumeCollections } from "./resumeData.js";
import { measurePageAnchors, planA4Pages } from "./pagination.js";
import { Modal } from "./Modal.jsx";

const initialProject = {
  id: "project-1",
  name: "",
  role: "",
  startDate: "",
  endDate: "",
  description: "",
  achievements: [""],
};
const emptyProject = () => ({ id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", role: "", startDate: "", endDate: "", description: "", achievements: [""] });
const initialEducation = { id: "education-1", school: "", major: "", degree: "", startDate: "", endDate: "", location: "" };
const emptyEducation = () => ({ ...initialEducation, id: `education-${crypto.randomUUID()}` });
const emptySkill = () => ({ id: `skill-${crypto.randomUUID()}`, label: "", value: "" });
const emptyInternship = () => ({ id: `internship-${crypto.randomUUID()}`, company: "", position: "", location: "", startDate: "", endDate: "", description: "" });
const emptyPublication = () => ({ id: `publication-${crypto.randomUUID()}`, title: "", authors: "", venue: "", publishedAt: "", doi: "" });
const emptyAward = () => ({ id: `award-${crypto.randomUUID()}`, title: "", issuer: "", date: "", level: "", description: "" });

const initialResume = {
  title: "",
  sectionTitles: { 基本信息: "个人简介", 教育经历: "教育经历", 实习经历: "实习经历", 项目经历: "项目经历", 发表论文: "发表论文", 得奖情况: "得奖情况", 技能: "专业技能", 自我评价: "自我评价" },
  basics: { name: "", jobTitle: "", phone: "", email: "", location: "", photo: null, summary: "" },
  educations: [initialEducation],
  projects: [initialProject],
  internships: [], publications: [], awards: [],
  skillEntries: [
    { id: "skill-languages", label: "编程语言", value: "" },
    { id: "skill-embedded", label: "嵌入式开发", value: "" },
    { id: "skill-protocols", label: "通信协议", value: "" },
    { id: "skill-tools", label: "开发工具", value: "" },
  ],
  selfEvaluation: "",
};
const initialSettings = {
  template: "classic", showPhoto: false, pageBorder: true, spacing: "standard", accent: "#2e5bea", hideEmptySections: true,
  moduleLayouts: { 基本信息: "bullets", 教育经历: "timeline", 实习经历: "timeline", 项目经历: "structured", 发表论文: "list", 得奖情况: "list", 技能: "tags", 自我评价: "bullets" },
};
const steps = ["基本信息", "教育经历", "项目经历", "更多经历", "技能", "调整样式"];
const templates = [
  { id: "classic", name: "经典简洁", note: "简洁大方，适合多数岗位" },
  { id: "tech", name: "技术专才", note: "突出技术能力，适合技术岗位" },
  { id: "modern", name: "现代双栏", note: "版式现代，信息层次清晰" },
  { id: "minimal", name: "极简留白", note: "纯净克制，突出经历内容" },
  { id: "academic", name: "学术履历", note: "正式稳重，适合研究与申请" },
];
const defaultOrder = ["基本信息", "教育经历", "实习经历", "项目经历", "发表论文", "得奖情况", "技能", "自我评价"];
const moduleDefinitions = {
  基本信息: { defaultTitle: "个人简介", recommendations: ["个人简介", "个人优势", "职业概述", "关于我"], layouts: [{ id: "bullets", label: "要点列表" }, { id: "columns", label: "双栏要点" }, { id: "paragraph", label: "段落" }] },
  教育经历: { defaultTitle: "教育经历", recommendations: ["教育经历", "教育背景", "学习经历", "学历信息"], layouts: [{ id: "timeline", label: "时间轴" }, { id: "card", label: "卡片" }, { id: "compact", label: "紧凑" }] },
  实习经历: { defaultTitle: "实习经历", recommendations: ["实习经历", "工作经历", "实践经历", "企业实习"], layouts: [{ id: "timeline", label: "时间轴" }, { id: "card", label: "卡片" }, { id: "compact", label: "紧凑" }] },
  项目经历: { defaultTitle: "项目经历", recommendations: ["项目经历", "核心项目", "实践经历", "项目成果"], layouts: [{ id: "structured", label: "结构化" }, { id: "bullets", label: "要点列表" }, { id: "card", label: "卡片" }] },
  发表论文: { defaultTitle: "发表论文", recommendations: ["发表论文", "学术论文", "研究成果", "论文发表"], layouts: [{ id: "list", label: "列表" }, { id: "card", label: "卡片" }, { id: "compact", label: "紧凑" }] },
  得奖情况: { defaultTitle: "得奖情况", recommendations: ["得奖情况", "获奖荣誉", "奖项荣誉", "荣誉奖励"], layouts: [{ id: "list", label: "列表" }, { id: "card", label: "卡片" }, { id: "compact", label: "紧凑" }] },
  技能: { defaultTitle: "专业技能", recommendations: ["专业技能", "技能清单", "核心能力", "技术栈"], layouts: [{ id: "groups", label: "分类列表" }, { id: "tags", label: "标签" }, { id: "columns", label: "双栏" }] },
  自我评价: { defaultTitle: "自我评价", recommendations: ["自我评价", "个人评价", "职业素养", "个人特点"], layouts: [{ id: "bullets", label: "要点列表" }, { id: "columns", label: "双栏要点" }, { id: "paragraph", label: "段落" }] },
};
const splitPoints = (text, fallback = "") => (text || fallback)
  .replace(/([。！？；])/g, "$1\n")
  .split(/\n+/)
  .map((item) => item.trim().replace(/^[-•·]\s*/, ""))
  .filter(Boolean);
const splitTags = (text) => (text || "").split(/[、，,]+/).map((item) => item.trim()).filter(Boolean);

function TemplateThumb({ template, selected, onSelect }) {
  return <button type="button" className={`template-card ${selected ? "selected" : ""}`} onClick={() => onSelect(template.id)} aria-pressed={selected}>
    <span className={`template-sheet thumb-${template.id}`}><span className="thumb-sidebar" /><span className="thumb-main"><span className="thumb-title" /><span className="thumb-meta" /><span className="thumb-rule" /><span className="thumb-lines">个人简介　项目经历</span><span className="thumb-rule short" /><span className="thumb-lines compact">技能　教育经历</span></span>{selected && <span className="template-check"><Check size={14} strokeWidth={3} /></span>}</span>
    <strong>{template.name}</strong><small>{template.note}</small>
  </button>;
}
function SectionHeading({ children }) { return <h3 className="resume-section-title">{children}</h3>; }

function ResumeDocument({ resume, settings, order, measureRef }) {
  const { basics, educations, projects, skillEntries } = resume;
  const photoSrc = basics.photo || null;
  const titleFor = (key) => resume.sectionTitles?.[key] || moduleDefinitions[key].defaultTitle;
  const layoutFor = (key) => settings.moduleLayouts?.[key] || initialSettings.moduleLayouts[key];
  const pointContent = (text, fallback, layout) => layout === "paragraph"
    ? <p>{text || fallback}</p>
    : <ul className={`content-points ${layout === "columns" ? "two-columns" : ""}`}>{splitPoints(text, fallback).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
  const visibleProjects = settings.hideEmptySections ? projects.filter(hasProjectContent) : projects;
  const visibleEducations = settings.hideEmptySections ? educations.filter(hasEducationContent) : educations;
  const skillGroups = skillEntries.filter((entry) => !settings.hideEmptySections || hasText(entry.value)).map((entry) => [entry.label || "技能分类", entry.value, entry.id]);
  const sections = {
    基本信息: <section key="basic" className={`module-section module-summary layout-${layoutFor("基本信息")}`}><SectionHeading>{titleFor("基本信息")}</SectionHeading>{pointContent(basics.summary, "请补充个人简介。", layoutFor("基本信息"))}</section>,
    教育经历: <section key="education" className={`module-section module-education layout-${layoutFor("教育经历")}`}><SectionHeading>{titleFor("教育经历")}</SectionHeading>{visibleEducations.map((entry) => <div className="education-entry" key={entry.id}><div className="resume-row"><strong>{entry.school || "学校名称"}</strong><span>{[entry.startDate, entry.endDate].filter(hasText).join(" — ")}</span></div><div className="resume-row muted"><span>{entry.major}{entry.degree ? `（${entry.degree}）` : ""}</span><span>{entry.location}</span></div></div>)}</section>,
    实习经历: <section key="internship" className={`module-section module-internship layout-${layoutFor("实习经历")}`}><SectionHeading>{titleFor("实习经历")}</SectionHeading>{resume.internships.filter((entry) => !settings.hideEmptySections || hasInternshipContent(entry)).map((entry) => <div className="internship-entry" key={entry.id}><div className="resume-row"><strong>{entry.company || "实习单位"}</strong><span>{[entry.startDate, entry.endDate].filter(hasText).join(" — ")}</span></div><div className="resume-row muted"><span>{entry.position}</span><span>{entry.location}</span></div><ul className="content-points">{splitPoints(entry.description).map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}</section>,
    项目经历: <section key="project" className={`module-section module-project layout-${layoutFor("项目经历")}`}><SectionHeading>{titleFor("项目经历")}</SectionHeading>{visibleProjects.map((project, projectIndex) => <div className="project-entry" key={project.id || projectIndex}><div className="resume-row project-title-row"><strong>{project.name || `项目 ${projectIndex + 1}`}</strong><span>{[project.startDate, project.endDate].filter(hasText).join(" — ")}</span></div>{hasText(project.role) && <div className="resume-role">{project.role}</div>}{hasText(project.description) && layoutFor("项目经历") === "structured" && <span className="content-label">项目概述</span>}<ul className="content-points project-points">{splitPoints(project.description).map((item, index) => <li key={`description-${index}`}>{item}</li>)}{project.achievements.filter(Boolean).map((item, index) => <li key={`achievement-${index}`}>{item}</li>)}</ul></div>)}</section>,
    发表论文: <section key="publication" className={`module-section module-publication layout-${layoutFor("发表论文")}`}><SectionHeading>{titleFor("发表论文")}</SectionHeading>{resume.publications.filter((entry) => !settings.hideEmptySections || hasPublicationContent(entry)).map((entry) => <div className="publication-entry" key={entry.id}><div className="resume-row"><strong>{entry.title || "论文题目"}</strong><span>{entry.publishedAt}</span></div><p>{[entry.authors, entry.venue, entry.doi && `DOI: ${entry.doi}`].filter(hasText).join(" · ")}</p></div>)}</section>,
    得奖情况: <section key="award" className={`module-section module-award layout-${layoutFor("得奖情况")}`}><SectionHeading>{titleFor("得奖情况")}</SectionHeading>{resume.awards.filter((entry) => !settings.hideEmptySections || hasAwardContent(entry)).map((entry) => <div className="award-entry" key={entry.id}><div className="resume-row"><strong>{entry.title || "奖项名称"}</strong><span>{entry.date}</span></div><p>{[entry.level, entry.issuer, entry.description].filter(hasText).join(" · ")}</p></div>)}</section>,
    技能: <section key="skills" className={`module-section module-skills layout-${layoutFor("技能")}`}><SectionHeading>{titleFor("技能")}</SectionHeading>{layoutFor("技能") === "tags" ? <div className="skill-groups">{skillGroups.map(([label, value, key]) => <div className="skill-group" key={key}><b>{label}</b><span>{splitTags(value).map((tag) => <i key={tag}>{tag}</i>)}</span></div>)}</div> : <ul className="skills-list">{skillGroups.map(([label, value, key]) => <li key={key}><b>{label}：</b>{value}</li>)}</ul>}</section>,
    自我评价: <section key="evaluation" className={`module-section module-evaluation layout-${layoutFor("自我评价")}`}><SectionHeading>{titleFor("自我评价")}</SectionHeading>{pointContent(resume.selfEvaluation, "请补充自我评价。", layoutFor("自我评价"))}</section>,
  };
  return <div ref={measureRef} className={`resume-page resume-document resume-${settings.template} density-${settings.spacing} ${settings.showPhoto ? "" : "hide-photo"}`} style={{ "--resume-accent": settings.accent }}>
    <div className="tech-bar" />
    <aside className="modern-sidebar">{settings.showPhoto && photoSrc && <img src={photoSrc} alt={`${basics.name}证件照`} />}{[basics.phone, basics.email, basics.location].some(hasText) && <div className="sidebar-block"><strong>联系方式</strong><span>{basics.phone}</span><span>{basics.email}</span><span>{basics.location}</span></div>}{skillGroups.some(([, value]) => hasText(value)) && <div className="sidebar-block"><strong>核心技能</strong>{skillGroups.filter(([, value]) => hasText(value)).map(([label, value, key]) => <span key={key}>{label} · {value}</span>)}</div>}</aside>
    <main className="resume-main"><header className="resume-header"><div><h1>{basics.name || "你的姓名"}</h1><p>{basics.jobTitle || "求职岗位"}</p><div className="contact-row">{hasText(basics.phone) && <span><Phone size={10} />{basics.phone}</span>}{hasText(basics.email) && <span><Mail size={10} />{basics.email}</span>}{hasText(basics.location) && <span><MapPin size={10} />{basics.location}</span>}</div></div>{settings.showPhoto && photoSrc && <img src={photoSrc} alt={`${basics.name}证件照`} />}</header>{order.filter((name) => !settings.hideEmptySections || sectionHasContent(name, resume)).map((name) => sections[name])}</main>
  </div>;
}

const A4_WIDTH = 610;
const A4_HEIGHT = A4_WIDTH * 297 / 210;
const PAGE_MARGIN = 28;

function ResumePreview({ resume, settings, order, previewRef, onPagesChange }) {
  const measureRef = useRef(null);
  const [pages, setPages] = useState([{ start: 0, end: A4_HEIGHT, topInset: 0, forced: false }]);
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return undefined;
    const measure = () => {
      const candidates = root.querySelectorAll(".resume-header, .module-section, .resume-section-title, .education-entry, .internship-entry, .project-entry, .publication-entry, .award-entry, .skill-group, .skills-list li, .content-points li, .resume-row, .resume-role, .resume-main p");
      const guarded = [...root.querySelectorAll(".module-section")].map((section) => {
        const heading = section.querySelector(".resume-section-title");
        const next = heading?.nextElementSibling;
        const first = next?.matches("ul") ? next.firstElementChild || next : next?.firstElementChild || next;
        return heading && first ? [heading, first] : null;
      }).filter(Boolean);
      const anchors = measurePageAnchors(root, candidates, guarded);
      const rootRect = root.getBoundingClientRect();
      const scale = rootRect.width / root.offsetWidth || 1;
      const lineStarts = [];
      const walker = document.createTreeWalker(root.querySelector(".resume-main"), NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) lineStarts.push((rect.top - rootRect.top) / scale);
      }
      const plan = planA4Pages({ ...anchors, candidates: [...anchors.candidates, ...lineStarts], pageHeight: A4_HEIGHT - PAGE_MARGIN, continuationTop: PAGE_MARGIN });
      setPages((current) => JSON.stringify(current) === JSON.stringify(plan) ? current : plan);
      onPagesChange((current) => JSON.stringify(current) === JSON.stringify(plan) ? current : plan);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(root);
    document.fonts?.ready.then(measure);
    return () => observer?.disconnect();
  }, [resume, settings, order, onPagesChange]);
  return <div ref={previewRef} id="resume-preview" className="resume-pages">
    <div className="pagination-measure" aria-hidden="true"><ResumeDocument resume={resume} settings={settings} order={order} measureRef={measureRef} /></div>
    {pages.map((page, index) => <div className={`resume-page-shell ${settings.pageBorder ? "" : "no-page-border"}`} key={index} data-page-index={index} data-forced-break={page.forced} aria-label={`简历第 ${index + 1} 页`}>
      <div className="resume-page-window" style={{ top: page.topInset, height: page.end - page.start }}><div className="resume-page-offset" style={{ top: -page.start }}><ResumeDocument resume={resume} settings={settings} order={order} /></div></div>
    </div>)}
  </div>;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = filename; link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const hydrateResume = (value) => ({
  ...deepCopy(initialResume), ...Object.fromEntries(Object.entries(value || {}).filter(([key]) => !["education", "skills", "skillLabels", "educations", "skillEntries"].includes(key))),
  sectionTitles: { ...initialResume.sectionTitles, ...(value?.sectionTitles || {}) },
  basics: { ...initialResume.basics, ...(value?.basics || {}) },
  ...normalizeResumeCollections(value || initialResume),
  project: undefined,
  projects: Array.isArray(value?.projects) && value.projects.length
    ? value.projects.map((project, index) => ({ ...initialProject, ...project, id: `project-${index + 1}`, achievements: Array.isArray(project.achievements) ? project.achievements : [] }))
    : [{ ...initialProject, ...(value?.project || {}), id: value?.project?.id || "project-1", achievements: Array.isArray(value?.project?.achievements) ? value.project.achievements : initialProject.achievements }],
});
const hydrateSettings = (value) => ({
  ...initialSettings, ...(value || {}),
  moduleLayouts: { ...initialSettings.moduleLayouts, ...(value?.moduleLayouts || {}) },
});

export function App() {
  const [loaded] = useState(() => readStoredResume({ getItem: (key) => window.localStorage.getItem(key) }));
  const saved = loaded.state;
  const [resume, setResume] = useState(() => hydrateResume(saved?.resume));
  const [settings, setSettings] = useState(() => hydrateSettings(saved?.settings));
  const [order, setOrder] = useState(() => normalizeOrder(saved?.order));
  const [activeStep, setActiveStep] = useState(0);
  const [mobileView, setMobileView] = useState("editor");
  const [pendingImport, setPendingImport] = useState(null);
  const [storageError, setStorageError] = useState(loaded.error);
  const [previewScale, setPreviewScale] = useState(1);
  const [pagePlan, setPagePlan] = useState([{ start: 0, end: A4_HEIGHT, topInset: 0, forced: false }]);
  const pageCount = pagePlan.length;
  const hasForcedBreak = pagePlan.some((page) => page.forced);
  const [dragged, setDragged] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [status, setStatus] = useState(saved ? "已恢复本地简历" : "保存在此设备");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [exportResult, setExportResult] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const previewRef = useRef(null); const titleRef = useRef(null); const photoInputRef = useRef(null);
  const importInputRef = useRef(null); const previewViewportRef = useRef(null);
  const stateRef = useRef(null); const dirtyRef = useRef(false);
  const undoRef = useRef([]); const redoRef = useRef([]);
  const completion = useMemo(() => resumeCompletion(resume), [resume]);
  const optionalExperienceDone = resume.internships.some(hasInternshipContent) || resume.publications.some(hasPublicationContent) || resume.awards.some(hasAwardContent);
  const stepComplete = [completion.steps[0], completion.steps[1], completion.steps[2], optionalExperienceDone, completion.steps[3], false];
  const progress = completion.percent;
  const snapshot = () => ({ resume: deepCopy(resume), settings: deepCopy(settings), order: [...order] });
  const commit = (change) => { dirtyRef.current = true; undoRef.current.push(snapshot()); if (undoRef.current.length > 60) undoRef.current.shift(); redoRef.current = []; change(); setHistoryVersion((v) => v + 1); };
  const applySnapshot = (state) => { dirtyRef.current = true; setResume(state.resume); setSettings(state.settings); setOrder(state.order); };
  const undo = () => { if (!undoRef.current.length) return; redoRef.current.push(snapshot()); applySnapshot(undoRef.current.pop()); setHistoryVersion((v) => v + 1); setToast("已撤销上一步操作"); };
  const redo = () => { if (!redoRef.current.length) return; undoRef.current.push(snapshot()); applySnapshot(redoRef.current.pop()); setHistoryVersion((v) => v + 1); setToast("已恢复操作"); };

  stateRef.current = { resume, settings, order };
  useEffect(() => {
    if (!dirtyRef.current) return;
    setStatus("保存中…");
    const id = setTimeout(() => {
      const ok = saveResume({ setItem: (key, value) => window.localStorage.setItem(key, value) }, { resume, settings, order });
      setStatus(ok ? "已保存到此设备" : "尚未保存");
      setStorageError(ok ? "" : "本地保存失败，可能是存储空间不足或浏览器限制。请先导出简历备份，避免内容丢失。");
    }, 350);
    return () => clearTimeout(id);
  }, [resume, settings, order]);
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) saveResume({ setItem: (key, value) => window.localStorage.setItem(key, value) }, stateRef.current); };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
  useEffect(() => {
    const closeMenus = (event) => { if (!event.target.closest(".settings-wrap, .export-wrap, .more-wrap")) { setSettingsOpen(false); setExportOpen(false); setMoreOpen(false); } };
    const escape = (event) => { if (event.key === "Escape") { setSettingsOpen(false); setExportOpen(false); setMoreOpen(false); } };
    document.addEventListener("pointerdown", closeMenus); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeMenus); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (viewport.clientWidth) setPreviewScale(Math.min(1, (viewport.clientWidth - 32) / 610)); });
    observer.observe(viewport); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2400); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select(); } }, [editingTitle]);
  useEffect(() => { if (activeProjectIndex >= resume.projects.length) setActiveProjectIndex(Math.max(0, resume.projects.length - 1)); }, [activeProjectIndex, resume.projects.length]);

  const updateNested = (section, field, value) => commit(() => setResume((current) => ({ ...current, [section]: { ...current[section], [field]: value } })));
  const updateRoot = (field, value) => commit(() => setResume((current) => ({ ...current, [field]: value })));
  const updateSetting = (field, value) => commit(() => setSettings((current) => ({ ...current, [field]: value })));
  const updateSectionTitle = (section, value) => commit(() => setResume((current) => ({ ...current, sectionTitles: { ...current.sectionTitles, [section]: value } })));
  const updateModuleLayout = (section, value) => commit(() => setSettings((current) => ({ ...current, moduleLayouts: { ...current.moduleLayouts, [section]: value } })));
  const updateEducation = (id, field, value) => commit(() => setResume((current) => ({ ...current, educations: current.educations.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) })));
  const addEducation = () => { if (resume.educations.length >= 50) { setToast("最多可添加 50 段教育经历"); return; } commit(() => setResume((current) => ({ ...current, educations: [...current.educations, emptyEducation()] }))); };
  const removeEducation = (id) => commit(() => setResume((current) => ({ ...current, educations: current.educations.filter((entry) => entry.id !== id) })));
  const updateSkill = (id, field, value) => commit(() => setResume((current) => ({ ...current, skillEntries: current.skillEntries.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) })));
  const addSkill = () => { if (resume.skillEntries.length >= 100) { setToast("最多可添加 100 个技能分类"); return; } commit(() => setResume((current) => ({ ...current, skillEntries: [...current.skillEntries, emptySkill()] }))); };
  const removeSkill = (id) => commit(() => setResume((current) => ({ ...current, skillEntries: current.skillEntries.filter((entry) => entry.id !== id) })));
  const updateEntry = (collection, id, field, value) => commit(() => setResume((current) => ({ ...current, [collection]: current[collection].map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) })));
  const addEntry = (collection, create, label) => {
    if (resume[collection].length >= 50) { setToast(`最多可添加 50 条${label}`); return; }
    commit(() => setResume((current) => ({ ...current, [collection]: [...current[collection], create()] })));
  };
  const removeEntry = (collection, id) => commit(() => setResume((current) => ({ ...current, [collection]: current[collection].filter((entry) => entry.id !== id) })));
  const selectTemplate = (id) => { if (id === settings.template) return; updateSetting("template", id); setToast(`已切换为${templates.find((t) => t.id === id)?.name}`); };
  const updateProject = (projectIndex, field, value) => commit(() => setResume((current) => ({ ...current, projects: current.projects.map((project, index) => index === projectIndex ? { ...project, [field]: value } : project) })));
  const updateAchievement = (projectIndex, achievementIndex, value) => commit(() => setResume((current) => ({ ...current, projects: current.projects.map((project, index) => index === projectIndex ? { ...project, achievements: project.achievements.map((item, itemIndex) => itemIndex === achievementIndex ? value : item) } : project) })));
  const addAchievement = (projectIndex) => commit(() => setResume((current) => ({ ...current, projects: current.projects.map((project, index) => index === projectIndex ? { ...project, achievements: [...project.achievements, ""] } : project) })));
  const removeAchievement = (projectIndex, achievementIndex) => commit(() => setResume((current) => ({ ...current, projects: current.projects.map((project, index) => index === projectIndex ? { ...project, achievements: project.achievements.filter((_, itemIndex) => itemIndex !== achievementIndex) } : project) })));
  const addProject = () => { const nextIndex = resume.projects.length; commit(() => setResume((current) => ({ ...current, projects: [...current.projects, emptyProject()] }))); setActiveProjectIndex(nextIndex); setToast("已新增一段项目经历"); };
  const removeProject = (projectIndex) => {
    if (resume.projects.length === 1) { setToast("至少保留一段项目经历"); return; }
    commit(() => setResume((current) => ({ ...current, projects: current.projects.filter((_, index) => index !== projectIndex) })));
    setActiveProjectIndex(Math.max(0, projectIndex - 1)); setToast("已删除该项目经历");
  };
  const optimizeCopy = () => {
    const project = resume.projects[activeProjectIndex];
    if (!project || !projectHasOptimizableContent(project)) {
      setToast("请先填写项目内容后再优化");
      return;
    }
    const optimizedProject = optimizeProjectCopy(project);
    if (JSON.stringify(optimizedProject) === JSON.stringify(project)) {
      setToast("内容已较规范，未作修改");
      return;
    }
    commit(() => setResume((current) => ({
      ...current,
      projects: current.projects.map((item, index) => index === activeProjectIndex ? optimizedProject : item),
    })));
    setToast("已按原意逐项优化当前项目");
  };
  const reorder = (target) => { if (!dragged || dragged === target) return; commit(() => setOrder((current) => { const next = current.filter((item) => item !== dragged); next.splice(next.indexOf(target), 0, dragged); return next; })); setDragged(null); setToast("模块顺序已同步到预览"); };
  const moveItem = (name, direction) => { const index = order.indexOf(name); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= order.length) return; commit(() => setOrder((current) => { const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next; })); setToast("模块顺序已同步到预览"); };

  const goNext = () => { if (activeStep < steps.length - 1) setActiveStep((s) => s + 1); else { setMobileView("preview"); setExportOpen(true); } };
  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setToast("请选择 JPG、PNG 或其他图片文件"); return; }
    if (file.size > 8 * 1024 * 1024) { setToast("图片不能超过 8MB"); return; }
    const reader = new FileReader();
    reader.onerror = () => setToast("图片读取失败，请重新选择");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setToast("图片格式无法识别");
      image.onload = () => {
        const targetWidth = 480; const targetHeight = 600; const targetRatio = targetWidth / targetHeight;
        let sourceWidth = image.width; let sourceHeight = image.height; let sourceX = 0; let sourceY = 0;
        if (sourceWidth / sourceHeight > targetRatio) { sourceWidth = sourceHeight * targetRatio; sourceX = (image.width - sourceWidth) / 2; }
        else { sourceHeight = sourceWidth / targetRatio; sourceY = (image.height - sourceHeight) / 2; }
        const canvas = document.createElement("canvas"); canvas.width = targetWidth; canvas.height = targetHeight;
        canvas.getContext("2d").drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
        const photo = canvas.toDataURL("image/jpeg", .88);
        commit(() => { setResume((current) => ({ ...current, basics: { ...current.basics, photo } })); setSettings((current) => ({ ...current, showPhoto: true })); });
        setToast("证件照已上传并同步到预览");
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const removePhoto = () => { commit(() => { setResume((current) => ({ ...current, basics: { ...current.basics, photo: null } })); setSettings((current) => ({ ...current, showPhoto: false })); }); setToast("证件照已移除"); };

  const exportPdf = async () => {
    if (!previewRef.current || busy) return;
    setMobileView("preview");
    setBusy("pdf"); setExportOpen(false); setExportResult("pdf-started");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const sourceNode = previewRef.current;
      await Promise.all([...sourceNode.querySelectorAll("img")].map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const pageNodes = [...sourceNode.querySelectorAll(".resume-page-shell")];
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (const [index, pageNode] of pageNodes.entries()) {
        const canvas = await html2canvas(pageNode, {
          scale: 2, backgroundColor: "#ffffff", useCORS: true,
          width: A4_WIDTH, height: Math.ceil(A4_HEIGHT), windowWidth: A4_WIDTH, windowHeight: Math.ceil(A4_HEIGHT),
          onclone: (clonedDocument) => {
            const clonedResume = clonedDocument.getElementById("resume-preview");
            for (let ancestor = clonedResume?.parentElement; ancestor; ancestor = ancestor.parentElement) {
              ancestor.style.transform = "none";
              ancestor.style.overflow = "visible";
            }
          },
        });
        if (index > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      downloadBlob(pdf.output("blob"), `${resume.basics.name || "我的"}-简历.pdf`);
      setExportResult("pdf-success"); setToast(`PDF 已完整导出，共 ${pageNodes.length} 页`);
    } catch (error) { setExportResult(`pdf-error:${error?.message || "unknown"}`); setToast("PDF 导出失败，请重试"); }
    finally { setBusy(""); }
  };
  const exportWord = async () => {
    if (busy) return;
    setBusy("word"); setExportOpen(false); setExportResult("word-started");
    try {
      const { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = await import("docx");
      const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 220, after: 100 } });
      const bullet = (text) => new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 70 } });
      const titled = (section) => resume.sectionTitles?.[section] || moduleDefinitions[section].defaultTitle;
      const textBlock = (section, text) => settings.moduleLayouts?.[section] === "paragraph" ? [new Paragraph(text)] : splitPoints(text).map(bullet);
      const b = resume.basics;
      const projectBlocks = resume.projects.filter(hasProjectContent).flatMap((project, index) => [
        new Paragraph({ spacing: { before: index ? 160 : 0, after: 60 }, children: [new TextRun({ text: project.name, bold: true }), new TextRun(`  ${[project.startDate, project.endDate].filter(hasText).join(" — ")}`)] }),
        ...(hasText(project.role) ? [new Paragraph({ text: project.role, spacing: { after: 60 } })] : []),
        ...splitPoints(project.description).map(bullet),
        ...project.achievements.filter(Boolean).map(bullet),
      ]);
      const skillBlocks = resume.skillEntries.filter((entry) => hasText(entry.value)).map((entry) => bullet(`${entry.label || "技能分类"}：${entry.value}`));
      const internshipBlocks = resume.internships.filter(hasInternshipContent).flatMap((entry, index) => [
        new Paragraph({ keepNext: hasText(entry.description), spacing: { before: index ? 140 : 0, after: 60 }, children: [new TextRun({ text: entry.company || "实习单位", bold: true }), new TextRun(`  ${entry.position}  ${[entry.startDate, entry.endDate].filter(hasText).join(" — ")}${hasText(entry.location) ? `  ${entry.location}` : ""}`)] }),
        ...splitPoints(entry.description).map(bullet),
      ]);
      const publicationBlocks = resume.publications.filter(hasPublicationContent).map((entry) => new Paragraph({ keepLines: true, spacing: { after: 100 }, children: [new TextRun({ text: entry.title || "论文题目", bold: true }), new TextRun(`  ${[entry.authors, entry.venue, entry.publishedAt, entry.doi && `DOI: ${entry.doi}`].filter(hasText).join(" · ")}`)] }));
      const awardBlocks = resume.awards.filter(hasAwardContent).map((entry) => new Paragraph({ keepLines: true, spacing: { after: 100 }, children: [new TextRun({ text: entry.title || "奖项名称", bold: true }), new TextRun(`  ${[entry.level, entry.issuer, entry.date, entry.description].filter(hasText).join(" · ")}`)] }));
      const photoChildren = [];
      if (settings.showPhoto && b.photo) {
        const photoResponse = await fetch(b.photo); const photoData = new Uint8Array(await photoResponse.arrayBuffer());
        const photoType = b.photo.startsWith("data:image/png") || b.photo.endsWith(".png") ? "png" : "jpg";
        photoChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoData, type: photoType, transformation: { width: 72, height: 90 } })] }));
      }
      const sectionBlocks = {
        基本信息: textBlock("基本信息", b.summary),
        教育经历: resume.educations.filter(hasEducationContent).map((entry, index) => new Paragraph({ spacing: { before: index ? 120 : 0, after: 70 }, children: [new TextRun({ text: entry.school, bold: true }), new TextRun(`  ${[entry.major, entry.degree].filter(hasText).join(" · ")}  ${[entry.startDate, entry.endDate].filter(hasText).join(" — ")}${hasText(entry.location) ? `  ${entry.location}` : ""}`)] })),
        实习经历: internshipBlocks, 项目经历: projectBlocks, 发表论文: publicationBlocks, 得奖情况: awardBlocks, 技能: skillBlocks, 自我评价: textBlock("自我评价", resume.selfEvaluation),
      };
      const orderedBlocks = order.filter((key) => sectionHasContent(key, resume)).flatMap((key) => [heading(titled(key)), ...sectionBlocks[key]]);
      const doc = new Document({ styles: { default: { document: { run: { font: "Microsoft YaHei", size: 21 }, paragraph: { spacing: { line: 280 } } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 1000, bottom: 850, left: 1000 } } }, children: [...photoChildren, new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b.name, bold: true, size: 36 })] }), new Paragraph({ text: b.jobTitle, alignment: AlignmentType.CENTER }), new Paragraph({ text: [b.phone, b.email, b.location].filter(hasText).join("  |  "), alignment: AlignmentType.CENTER, spacing: { after: 180 } }), ...orderedBlocks] }] });
      downloadBlob(await Packer.toBlob(doc), `${b.name || "我的"}-简历.docx`); setExportResult("word-success"); setToast("Word 文档已开始下载");
    } catch (error) { setExportResult(`word-error:${error?.message || "unknown"}`); setToast("Word 导出失败，请重试"); }
    finally { setBusy(""); }
  };
  const exportJson = () => { downloadBlob(new Blob([createBackup({ resume, settings, order })], { type: "application/json" }), `${resume.title || "resume"}.json`); setMoreOpen(false); setToast("简历备份已导出，可在其他设备导入继续编辑"); };
  const importJson = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; setMoreOpen(false);
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setToast("备份文件不能超过 8 MB"); return; }
    try { setPendingImport(parseResumeBackup(await file.text())); } catch (error) { setToast(error.message || "无法读取备份文件"); }
  };
  const confirmImport = () => {
    commit(() => { setResume(hydrateResume(pendingImport.resume)); setSettings(hydrateSettings(pendingImport.settings)); setOrder(pendingImport.order); });
    setPendingImport(null); setActiveProjectIndex(0); setActiveStep(0); setMobileView("editor"); setToast("备份已恢复；可通过撤销找回导入前的内容");
  };
  const clearResumeContent = () => { if (!window.confirm("确定清空全部内容吗？当前内容仍可通过撤销找回。")) return; commit(() => { setResume(deepCopy(initialResume)); setSettings((current) => ({ ...current, showPhoto: false })); }); setActiveProjectIndex(0); setMoreOpen(false); setToast("已清空全部内容"); };

  const field = (label, value, onChange, options = {}) => <label className={options.full ? "full" : ""}><span>{label}{options.required && <> <b>*</b></>}{options.hint && <em>{options.hint}</em>}</span><div className={options.textarea ? "textarea-wrap" : "input-wrap"}>{options.textarea ? <textarea aria-label={label} value={value} maxLength={options.max || 500} onChange={(e) => onChange(e.target.value)} /> : <input aria-label={label} value={value} type={options.type || "text"} maxLength={options.max || 100} onChange={(e) => onChange(e.target.value)} />}{options.max && <small>{value.length}/{options.max}</small>}</div></label>;
  const currentPhoto = resume.basics.photo || null;
  const photoEditor = <div className="photo-editor">
    <div className="photo-preview">{currentPhoto ? <img src={currentPhoto} alt="当前证件照" /> : <ImageIcon size={28} />}</div>
    <div><strong>证件照</strong><p>支持 JPG、PNG，自动裁剪为 4:5；图片仅保存在当前浏览器</p><div className="photo-actions"><button type="button" className="upload-photo-button" onClick={() => photoInputRef.current?.click()}><ImageIcon size={16} />{currentPhoto ? "更换证件照" : "添加证件照"}</button>{currentPhoto && <button type="button" className="remove-photo-button" onClick={removePhoto}>移除</button>}</div></div>
    <input ref={photoInputRef} className="sr-only" type="file" accept="image/*" aria-label="上传证件照" onChange={handlePhotoUpload} />
  </div>;
  const moduleCustomizer = <div className="module-customizer">
    <div className="customizer-heading"><div><strong>模块标题与排版</strong><span>使用推荐名称，或直接输入自己的标题；每个模块可独立选择布局</span></div><span className="structured-badge">已结构化</span></div>
    {defaultOrder.map((section) => {
      const definition = moduleDefinitions[section];
      const currentTitle = resume.sectionTitles?.[section] || "";
      const selectValue = definition.recommendations.includes(currentTitle) ? currentTitle : "__custom__";
      const currentLayout = settings.moduleLayouts?.[section] || initialSettings.moduleLayouts[section];
      return <section className="module-config-card" key={section}>
        <div className="module-config-head"><strong>{section}</strong><span>预览标题：{currentTitle || definition.defaultTitle}</span></div>
        <div className="module-title-controls"><label><span>推荐名称</span><select aria-label={`${section}推荐名称`} value={selectValue} onChange={(e) => updateSectionTitle(section, e.target.value === "__custom__" ? "" : e.target.value)}>{definition.recommendations.map((name) => <option key={name} value={name}>{name}</option>)}<option value="__custom__">自定义名称</option></select></label><label><span>自定义名称</span><input aria-label={`${section}自定义名称`} value={currentTitle} maxLength={20} placeholder={definition.defaultTitle} onChange={(e) => updateSectionTitle(section, e.target.value)} /></label></div>
        <div className="layout-picker"><span>内容排版</span><div>{definition.layouts.map((layout) => <button type="button" key={layout.id} className={currentLayout === layout.id ? "active" : ""} aria-pressed={currentLayout === layout.id} onClick={() => updateModuleLayout(section, layout.id)}>{layout.label}</button>)}</div></div>
      </section>;
    })}
  </div>;
  const currentProject = resume.projects[activeProjectIndex] || resume.projects[0];
  const projectEditor = <>
    <div className="project-manager">
      <div className="project-tabs" role="tablist" aria-label="项目经历列表">{resume.projects.map((project, index) => <button type="button" role="tab" aria-selected={index === activeProjectIndex} className={index === activeProjectIndex ? "active" : ""} key={project.id || index} onClick={() => setActiveProjectIndex(index)}><span>{index + 1}</span>{project.name || `未命名项目 ${index + 1}`}</button>)}</div>
      <button type="button" className="add-project-button" onClick={addProject}><Plus size={16} /> 新增项目经历</button>
    </div>
    <div className="project-editor-head"><div><strong>项目 {activeProjectIndex + 1}</strong><span>共 {resume.projects.length} 段项目经历</span></div><button type="button" className="delete-project-button" disabled={resume.projects.length === 1} onClick={() => removeProject(activeProjectIndex)}><Trash2 size={15} /> 删除本项目</button></div>
    <div className="form-grid">{field("项目名称", currentProject.name, (v) => updateProject(activeProjectIndex, "name", v), { full: true, required: true, max: 100 })}{field("担任角色", currentProject.role, (v) => updateProject(activeProjectIndex, "role", v), { required: true, max: 50 })}<label><span>项目时间 <b>*</b></span><div className="date-group"><CalendarDays size={17} /><input aria-label="项目开始时间" value={currentProject.startDate} onChange={(e) => updateProject(activeProjectIndex, "startDate", e.target.value)} /><i>—</i><input aria-label="项目结束时间" value={currentProject.endDate} onChange={(e) => updateProject(activeProjectIndex, "endDate", e.target.value)} /></div></label>{field("项目描述", currentProject.description, (v) => updateProject(activeProjectIndex, "description", v), { full: true, textarea: true, required: true, max: 500, hint: "描述会按句号或换行拆成独立要点" })}</div>
    <div className="achievement-block"><span className="field-label">项目成果</span>{currentProject.achievements.map((item, index) => <div className="achievement-row" key={index}><GripVertical size={17} /><input aria-label={`项目 ${activeProjectIndex + 1} 成果 ${index + 1}`} value={item} onChange={(e) => updateAchievement(activeProjectIndex, index, e.target.value)} /><button type="button" onClick={() => removeAchievement(activeProjectIndex, index)} aria-label={`删除项目 ${activeProjectIndex + 1} 成果 ${index + 1}`}><Trash2 size={17} /></button></div>)}<button type="button" className="add-button" onClick={() => addAchievement(activeProjectIndex)}><Plus size={16} /> 添加成果</button></div>
  </>;
  const skillsEditor = <div className="skill-editor-list">
    {resume.skillEntries.map((entry, index) => <div className="skill-editor-row editable-collection-row" key={entry.id}>
      <div className="collection-row-head"><strong>技能分类 {index + 1}</strong><button type="button" className="delete-project-button" aria-label={`删除技能分类 ${index + 1}`} onClick={() => removeSkill(entry.id)}><Trash2 size={15} /> 删除</button></div>
      <label><span>分类名称</span><input aria-label={`技能分类 ${index + 1} 名称`} value={entry.label} maxLength={20} placeholder="如：编程语言" onChange={(e) => updateSkill(entry.id, "label", e.target.value)} /></label>
      <label><span>技能内容</span><input aria-label={`技能分类 ${index + 1} 内容`} value={entry.value} maxLength={160} placeholder="如：C、Python" onChange={(e) => updateSkill(entry.id, "value", e.target.value)} /></label>
    </div>)}
    <button type="button" className="add-project-button collection-add" disabled={resume.skillEntries.length >= 100} onClick={addSkill}><Plus size={16} /> 新增技能分类</button>
  </div>;
  const moreExperienceEditor = <div className="more-experience-editor">
    <section className="optional-editor-section"><div className="section-heading"><div><h2>实习经历</h2><p>填写实习单位、岗位及具体工作内容</p></div></div>
      {resume.internships.map((entry, index) => <div className="editable-collection-card" key={entry.id}><div className="collection-row-head"><strong>实习经历 {index + 1}</strong><button type="button" className="delete-project-button" onClick={() => removeEntry("internships", entry.id)}><Trash2 size={15} /> 删除</button></div><div className="form-grid">
        {field(`实习经历 ${index + 1} 单位名称`, entry.company, (value) => updateEntry("internships", entry.id, "company", value), { full: true })}
        {field(`实习经历 ${index + 1} 岗位`, entry.position, (value) => updateEntry("internships", entry.id, "position", value))}
        {field(`实习经历 ${index + 1} 地点`, entry.location, (value) => updateEntry("internships", entry.id, "location", value))}
        {field(`实习经历 ${index + 1} 开始时间`, entry.startDate, (value) => updateEntry("internships", entry.id, "startDate", value))}
        {field(`实习经历 ${index + 1} 结束时间`, entry.endDate, (value) => updateEntry("internships", entry.id, "endDate", value))}
        {field(`实习经历 ${index + 1} 工作内容`, entry.description, (value) => updateEntry("internships", entry.id, "description", value), { full: true, textarea: true, max: 800, hint: "可按句号或换行分成要点" })}
      </div></div>)}<button type="button" className="add-project-button collection-add" disabled={resume.internships.length >= 50} onClick={() => addEntry("internships", emptyInternship, "实习经历")}><Plus size={16} /> 新增实习经历</button>
    </section>
    <section className="optional-editor-section"><div className="section-heading"><div><h2>发表论文</h2><p>可记录作者、发表刊物或会议与 DOI</p></div></div>
      {resume.publications.map((entry, index) => <div className="editable-collection-card" key={entry.id}><div className="collection-row-head"><strong>论文 {index + 1}</strong><button type="button" className="delete-project-button" onClick={() => removeEntry("publications", entry.id)}><Trash2 size={15} /> 删除</button></div><div className="form-grid">
        {field(`论文 ${index + 1} 标题`, entry.title, (value) => updateEntry("publications", entry.id, "title", value), { full: true, max: 200 })}
        {field(`论文 ${index + 1} 作者`, entry.authors, (value) => updateEntry("publications", entry.id, "authors", value), { max: 200 })}
        {field(`论文 ${index + 1} 期刊或会议`, entry.venue, (value) => updateEntry("publications", entry.id, "venue", value), { max: 200 })}
        {field(`论文 ${index + 1} 发表时间`, entry.publishedAt, (value) => updateEntry("publications", entry.id, "publishedAt", value))}
        {field(`论文 ${index + 1} DOI`, entry.doi, (value) => updateEntry("publications", entry.id, "doi", value), { max: 200 })}
      </div></div>)}<button type="button" className="add-project-button collection-add" disabled={resume.publications.length >= 50} onClick={() => addEntry("publications", emptyPublication, "论文")}><Plus size={16} /> 新增论文</button>
    </section>
    <section className="optional-editor-section"><div className="section-heading"><div><h2>得奖情况</h2><p>记录奖项名称、等级、颁发单位和时间</p></div></div>
      {resume.awards.map((entry, index) => <div className="editable-collection-card" key={entry.id}><div className="collection-row-head"><strong>奖项 {index + 1}</strong><button type="button" className="delete-project-button" onClick={() => removeEntry("awards", entry.id)}><Trash2 size={15} /> 删除</button></div><div className="form-grid">
        {field(`奖项 ${index + 1} 名称`, entry.title, (value) => updateEntry("awards", entry.id, "title", value), { full: true, max: 200 })}
        {field(`奖项 ${index + 1} 等级`, entry.level, (value) => updateEntry("awards", entry.id, "level", value))}
        {field(`奖项 ${index + 1} 颁发单位`, entry.issuer, (value) => updateEntry("awards", entry.id, "issuer", value))}
        {field(`奖项 ${index + 1} 获奖时间`, entry.date, (value) => updateEntry("awards", entry.id, "date", value))}
        {field(`奖项 ${index + 1} 补充说明`, entry.description, (value) => updateEntry("awards", entry.id, "description", value), { full: true, max: 300 })}
      </div></div>)}<button type="button" className="add-project-button collection-add" disabled={resume.awards.length >= 50} onClick={() => addEntry("awards", emptyAward, "奖项")}><Plus size={16} /> 新增奖项</button>
    </section>
  </div>;

  const forms = [
    <><div className="section-heading"><div><h2>填写基本信息</h2><p>完善联系方式和个人简介，预览将实时同步</p></div></div>{photoEditor}<div className="form-grid">{field("姓名", resume.basics.name, (v) => updateNested("basics", "name", v), { required: true })}{field("求职岗位", resume.basics.jobTitle, (v) => updateNested("basics", "jobTitle", v), { required: true })}{field("手机号码", resume.basics.phone, (v) => updateNested("basics", "phone", v))}{field("电子邮箱", resume.basics.email, (v) => updateNested("basics", "email", v), { type: "email" })}{field("所在城市", resume.basics.location, (v) => updateNested("basics", "location", v))}{field("个人简介", resume.basics.summary, (v) => updateNested("basics", "summary", v), { full: true, textarea: true, max: 300, hint: "换行或使用句号，预览会自动拆分为要点" })}</div></>,
    <><div className="section-heading"><div><h2>添加教育经历</h2><p>可填写多段教育经历，并自由增减</p></div></div>
      <div className="education-editor-list">{resume.educations.map((entry, index) => <section className="editable-collection-card" key={entry.id}>
        <div className="collection-row-head"><strong>教育经历 {index + 1}</strong><button type="button" className="delete-project-button" aria-label={`删除教育经历 ${index + 1}`} onClick={() => removeEducation(entry.id)}><Trash2 size={15} /> 删除</button></div>
        <div className="form-grid">{field(`教育经历 ${index + 1} 学校名称`, entry.school, (value) => updateEducation(entry.id, "school", value), { full: true, required: true })}
        {field(`教育经历 ${index + 1} 专业`, entry.major, (value) => updateEducation(entry.id, "major", value))}
        {field(`教育经历 ${index + 1} 学历`, entry.degree, (value) => updateEducation(entry.id, "degree", value))}
        {field(`教育经历 ${index + 1} 开始时间`, entry.startDate, (value) => updateEducation(entry.id, "startDate", value))}
        {field(`教育经历 ${index + 1} 结束时间`, entry.endDate, (value) => updateEducation(entry.id, "endDate", value))}
        {field(`教育经历 ${index + 1} 所在城市`, entry.location, (value) => updateEducation(entry.id, "location", value), { full: true })}</div>
      </section>)}</div>
      <button type="button" className="add-project-button collection-add" disabled={resume.educations.length >= 50} onClick={addEducation}><Plus size={16} /> 新增教育经历</button>
    </>,
    <><div className="section-heading"><div><h2>添加项目经历</h2><p>可添加多段项目，并分别填写职责与成果</p></div></div>{projectEditor}</>,
    <><div className="section-heading"><div><h2>补充更多经历</h2><p>实习、论文和奖项均为可选内容，可自由增加或删除</p></div></div>{moreExperienceEditor}</>,
    <><div className="section-heading"><div><h2>完善技能与自我评价</h2><p>分类名称和技能内容都可自行修改</p></div></div>{skillsEditor}<div className="form-grid evaluation-editor">{field("自我评价", resume.selfEvaluation, (v) => updateRoot("selfEvaluation", v), { full: true, textarea: true, max: 300, hint: "换行或使用句号，默认以要点展示" })}</div></>,
    <><div className="section-heading"><div><h2>调整简历样式</h2><p>自定义模块名称、内容布局和整体视觉</p></div></div><div className="style-controls"><span className="field-label">强调色</span><div className="color-row">{["#2e5bea", "#0f766e", "#7c3aed", "#c2410c"].map((color) => <button type="button" key={color} aria-label={`选择强调色 ${color}`} aria-pressed={settings.accent === color} className={settings.accent === color ? "active" : ""} style={{ background: color }} onClick={() => updateSetting("accent", color)} />)}</div><label><span className="field-label">内容密度</span><select aria-label="内容密度" value={settings.spacing} onChange={(e) => updateSetting("spacing", e.target.value)}><option value="compact">紧凑</option><option value="standard">标准</option><option value="comfortable">舒展</option></select></label><label className="toggle-row"><span>显示证件照</span><input type="checkbox" checked={settings.showPhoto} onChange={(e) => updateSetting("showPhoto", e.target.checked)} /></label><label className="toggle-row"><span>显示 A4 页面边界</span><input type="checkbox" checked={settings.pageBorder} onChange={(e) => updateSetting("pageBorder", e.target.checked)} /></label></div>{moduleCustomizer}</>,
  ];

  return <div className="app-shell" data-view={mobileView}>
    <header className="topbar">
      <div className="brand-block"><span className="brand-symbol"><FileText size={21} /></span><strong className="brand">简历工坊</strong></div>
      {editingTitle ? <input ref={titleRef} className="title-input" aria-label="简历名称" value={resume.title} maxLength={30} onChange={(e) => updateRoot("title", e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }} /> : <button type="button" className="document-title" onClick={() => setEditingTitle(true)} aria-label="编辑简历名称">{resume.title || "我的第一份简历"} <Pencil size={15} /></button>}
      <div className="top-actions">
        <button type="button" className="icon-button" onClick={undo} disabled={!undoRef.current.length} aria-label="撤销"><Undo2 size={19} /></button><button type="button" className="icon-button" onClick={redo} disabled={!redoRef.current.length} aria-label="重做"><Redo2 size={19} /></button>
        <div className="export-wrap"><button type="button" className="primary-button export-trigger" disabled={Boolean(busy)} aria-expanded={exportOpen} onClick={() => { setExportOpen(!exportOpen); setSettingsOpen(false); setMoreOpen(false); }}><Download size={18} /> {busy ? "生成中…" : "导出简历"} <ChevronDown size={16} /></button>
          {exportOpen && <div className="export-menu"><button type="button" onClick={exportPdf} disabled={Boolean(busy)}><span className="file-icon pdf"><FileText size={21} /></span><span><strong>PDF 文档</strong><small>保留当前版式，适合投递</small></span></button><button type="button" onClick={exportWord} disabled={Boolean(busy)}><span className="file-icon word"><FileText size={21} /></span><span><strong>Word 文档</strong><small>可编辑文字，版式有所不同</small></span></button></div>}
        </div>
        <div className="more-wrap"><button type="button" className="icon-button" aria-label="更多选项" aria-expanded={moreOpen} onClick={() => { setMoreOpen(!moreOpen); setSettingsOpen(false); setExportOpen(false); }}><MoreHorizontal size={21} /></button>{moreOpen && <div className="more-menu"><button type="button" onClick={exportJson}>导出备份（JSON）</button><button type="button" onClick={() => importInputRef.current?.click()}>导入备份</button><button type="button" className="danger-text" onClick={clearResumeContent}>清空全部内容</button></div>}</div>
      </div>
      <input ref={importInputRef} className="sr-only" type="file" accept=".json,application/json" aria-label="导入简历备份" onChange={importJson} />
    </header>
    <div className="workspace-heading"><div><span className="eyebrow">RESUME WORKSPACE</span><h1>让每一段经历，都被看见。</h1><p>从内容到排版，专注打造你的下一次机会。</p></div><span className={`save-status ${storageError ? "save-warning" : ""}`} role="status"><CircleCheck size={16} />{status}<small>内容仅存于当前浏览器</small></span></div>
    {storageError && <div className="storage-alert" role="alert"><span>{storageError}</span><button type="button" onClick={exportJson}>导出备份</button></div>}
    <div className="mobile-view-switch" aria-label="工作区视图"><button type="button" aria-pressed={mobileView === "editor"} onClick={() => setMobileView("editor")}><Pencil size={17} />编辑内容</button><button type="button" aria-pressed={mobileView === "preview"} onClick={() => setMobileView("preview")}><FileText size={17} />查看预览</button></div>
    <div className="workspace">
      <section className="editor-panel" aria-label="简历编辑">
        <nav className="stepper" aria-label="简历制作步骤">{steps.map((step, index) => <button type="button" key={step} aria-current={index === activeStep ? "step" : undefined} className={index === activeStep ? "active" : stepComplete[index] ? "done" : ""} onClick={() => setActiveStep(index)}><span>{stepComplete[index] ? <Check size={14} strokeWidth={3} /> : index + 1}</span>{step}</button>)}</nav>
        <div className="completion-row"><span>内容完善度 <strong>{progress}%</strong></span><div className="progress-track" role="progressbar" aria-label="内容完善度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div></div>
        <div className="panel-section form-section">{forms[activeStep]}
          <div className="form-actions">{activeStep === 2 && <button type="button" className="optimize-button" onClick={optimizeCopy} title="仅优化当前项目已填写的内容"><Sparkles size={17} /> 优化措辞</button>}{activeStep > 0 && <button type="button" className="back-button" onClick={() => setActiveStep((s) => s - 1)}><ArrowLeft size={16} /> 上一步</button>}<button type="button" className="continue-button" onClick={goNext}>{activeStep === steps.length - 1 ? "预览并导出" : "下一步"} <ArrowRight size={17} /></button></div>
        </div>
      </section>
      <aside className="preview-panel" aria-label="简历预览">
        <div className="preview-toolbar"><div><strong>实时预览</strong><span>A4 · {templates.find((item) => item.id === settings.template)?.name}</span></div><div className="settings-wrap"><button type="button" className="secondary-button" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(!settingsOpen); setExportOpen(false); setMoreOpen(false); }}><Settings2 size={16} /> 预览设置</button>{settingsOpen && <div className="settings-popover"><strong>预览设置</strong><label><input type="checkbox" checked={settings.showPhoto} onChange={(e) => updateSetting("showPhoto", e.target.checked)} /> 显示照片</label><label><input type="checkbox" checked={settings.pageBorder} onChange={(e) => updateSetting("pageBorder", e.target.checked)} /> A4 页面边界</label><label><input type="checkbox" checked={settings.hideEmptySections} onChange={(e) => updateSetting("hideEmptySections", e.target.checked)} /> 隐藏空白模块</label><label>内容密度<select aria-label="预览内容密度" value={settings.spacing} onChange={(e) => updateSetting("spacing", e.target.value)}><option value="compact">紧凑</option><option value="standard">标准</option><option value="comfortable">舒展</option></select></label></div>}</div></div>
        <div className="template-strip" aria-label="选择简历模板">{templates.map((item) => <button type="button" key={item.id} aria-pressed={settings.template === item.id} onClick={() => selectTemplate(item.id)}>{settings.template === item.id && <Check size={15} />}{item.name}</button>)}<button type="button" className="browse-templates" aria-label="浏览模板版式" onClick={() => setGalleryOpen(true)}><ImageIcon size={17} /></button></div>
        <div className="preview-viewport" ref={previewViewportRef}><div className="preview-stage" style={{ width: A4_WIDTH * previewScale, height: (pageCount * A4_HEIGHT + (pageCount - 1) * 18) * previewScale }}><div className="preview-transform" style={{ transform: `scale(${previewScale})` }}><ResumePreview resume={resume} settings={settings} order={order} previewRef={previewRef} onPagesChange={setPagePlan} /></div></div></div>
        <div className={`preview-caption ${hasForcedBreak ? "overflow-notice" : ""}`}>{hasForcedBreak ? `共 ${pageCount} 页；有一段内容过长，请检查页末是否需要手动分句。` : `A4 实时预览 · 共 ${pageCount} 页 · PDF 将按预览分页导出`}</div>
      </aside>
    </div>
    <footer className="reorder-bar"><div className="reorder-hint"><GripVertical size={20} /><strong>拖动调整模块顺序</strong><span>也可用左右箭头调整，预览会即时同步</span></div><div className="reorder-items">{order.map((item) => { const displayTitle = resume.sectionTitles?.[item] || moduleDefinitions[item].defaultTitle; const active = item === steps[activeStep] || (activeStep === 3 && ["实习经历", "发表论文", "得奖情况"].includes(item)); return <div className="reorder-item" key={item}><button type="button" draggable onDragStart={() => setDragged(item)} onDragEnd={() => setDragged(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => reorder(item)} className={active ? "active" : ""}>{item === "基本信息" && <UserRound size={16} />}{["教育经历", "实习经历"].includes(item) && <BriefcaseBusiness size={16} />}{["项目经历", "发表论文"].includes(item) && <FileText size={16} />}{item === "得奖情况" && <CircleCheck size={16} />}{item === "技能" && <ImageIcon size={16} />}{item === "自我评价" && <CircleCheck size={16} />}<span className="reorder-name">{displayTitle}</span><GripVertical size={16} /></button><span className="reorder-controls"><button type="button" aria-label={`${displayTitle}向左移动`} onClick={() => moveItem(item, -1)}>‹</button><button type="button" aria-label={`${displayTitle}向右移动`} onClick={() => moveItem(item, 1)}>›</button></span></div>; })}</div></footer>
    {galleryOpen && <Modal title="选择简历模板" titleId="template-title" onClose={() => setGalleryOpen(false)}><p className="modal-description">切换版式会保留所有内容，你可以随时调整。</p><div className="modal-template-grid">{templates.map((item) => <TemplateThumb key={item.id} template={item} selected={settings.template === item.id} onSelect={(id) => { selectTemplate(id); setGalleryOpen(false); }} />)}</div></Modal>}
    {pendingImport && <Modal title="恢复简历备份" titleId="import-title" onClose={() => setPendingImport(null)} className="import-modal"><p className="modal-description">将替换当前内容、样式和模块顺序。导入后可通过撤销恢复。</p><div className="import-summary"><strong>{pendingImport.resume.title || pendingImport.resume.basics?.name || "未命名简历"}</strong><span>{pendingImport.resume.projects?.filter(hasProjectContent).length || 0} 段项目经历</span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPendingImport(null)}>取消</button><button type="button" className="primary-button" onClick={confirmImport}>确认导入</button></div></Modal>}
    {toast && <div className="toast" role="status">{toast}</div>}<output data-testid="export-status" className="sr-only">{exportResult}</output><output data-testid="history-version" className="sr-only">{historyVersion}</output>
  </div>;
}

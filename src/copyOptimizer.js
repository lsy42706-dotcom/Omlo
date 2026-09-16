const cleanSpacing = (value = "") => value
  .replace(/\u00a0/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, "$1")
  .replace(/ *\n */g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\s*([，。；：、！？])\s*/g, "$1")
  .replace(/([，。；：、！？])\1+/g, "$1")
  .trim();

const conservativeReplacements = [
  [/我主要负责/g, "负责"],
  [/主要负责/g, "负责"],
  [/负责了/g, "负责"],
  [/参与了/g, "参与"],
  [/完成了/g, "完成"],
  [/实现了/g, "实现"],
];

export const normalizeResumeCell = (value = "") => cleanSpacing(value);

export const polishResumeCell = (value = "", { completeSentence = false } = {}) => {
  if (!value.trim()) return "";
  let polished = cleanSpacing(value);
  conservativeReplacements.forEach(([pattern, replacement]) => {
    polished = polished.replace(pattern, replacement);
  });
  polished = cleanSpacing(polished);
  if (completeSentence && polished && !/[。！？]$/.test(polished)) polished += "。";
  return polished;
};

export const projectHasOptimizableContent = (project) => [
  project?.name,
  project?.role,
  project?.description,
  ...(project?.achievements || []),
].some((value) => Boolean(value?.trim()));

export const optimizeProjectCopy = (project) => ({
  ...project,
  name: normalizeResumeCell(project.name),
  role: normalizeResumeCell(project.role),
  description: polishResumeCell(project.description, { completeSentence: true }),
  achievements: (project.achievements || []).map((item) => polishResumeCell(item)),
});

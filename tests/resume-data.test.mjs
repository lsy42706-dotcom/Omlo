import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResumeBackup, createBackup, normalizeOrder, SECTION_ORDER, resumeCompletion, sectionHasContent, readStoredResume, saveResume, STORAGE_KEY, normalizeResumeCollections } from '../src/resumeData.js';

const blank = () => ({ basics: { name: '', jobTitle: '', phone: '', email: '', summary: '' }, education: { school: '', major: '' }, projects: [{ name: '', description: '', achievements: [''] }], skills: { languages: '' }, selfEvaluation: '' });
test('completion measures actual content, including email when phone is whitespace', () => {
  const resume = blank();
  assert.equal(resumeCompletion(resume).percent, 0);
  resume.basics = { ...resume.basics, name: '测试姓名', jobTitle: '嵌入式开发', phone: ' ', email: 'test@example.com' };
  assert.deepEqual(resumeCompletion(resume).steps, [true, false, false, false]);
  resume.education = { school: '测试大学', major: '电子工程' };
  resume.projects[0] = { name: '测试项目', description: '实现控制模块', achievements: [] };
  resume.skills.languages = 'C';
  assert.equal(resumeCompletion(resume).percent, 100);
});
test('empty modules are omitted, achievement-only projects remain visible', () => {
  const resume = blank();
  assert.ok(SECTION_ORDER.every((key) => !sectionHasContent(key, resume)));
  resume.projects[0].achievements = ['完成系统联调'];
  assert.equal(sectionHasContent('项目经历', resume), true);
  assert.equal(sectionHasContent('不存在', resume), false);
});
test('backup round trip preserves content, settings and normalized module order', () => {
  const state = { resume: blank(), settings: { template: 'modern', hideEmptySections: true, accent: '#0f766e', moduleLayouts: { 技能: 'columns' } }, order: [...SECTION_ORDER].reverse() };
  assert.deepEqual(parseResumeBackup(createBackup(state)), state);
  assert.deepEqual(normalizeOrder(['技能', '技能', 'unknown']), ['技能', ...SECTION_ORDER.filter((key) => key !== '技能')]);
});
test('legacy backups remain readable and invalid settings use safe defaults', () => {
  const parsed = parseResumeBackup(JSON.stringify({ resume: { project: { name: '旧版项目', achievements: [] } }, settings: { template: 'unknown', accent: 'red', showPhoto: 'true', moduleLayouts: { 技能: 'unknown' } } }));
  assert.equal(parsed.resume.project.name, '旧版项目');
  assert.deepEqual(parsed.settings, { moduleLayouts: {} });
  assert.deepEqual(parsed.order, SECTION_ORDER);
});
test('older single education and fixed skills migrate without dropping user content', () => {
  const migrated = normalizeResumeCollections({ education: { school: '测试大学', major: '电子工程' }, skills: { embedded: 'STM32', languages: 'C' }, skillLabels: { embedded: '硬件开发' } });
  assert.equal(migrated.educations.length, 1);
  assert.equal(migrated.educations[0].school, '测试大学');
  assert.deepEqual(migrated.skillEntries.filter((entry) => entry.value).map(({ label, value }) => [label, value]), [['编程语言', 'C'], ['硬件开发', 'STM32']]);
});
test('multiple education and custom skills survive backup and affect completeness', () => {
  const resume = { ...blank(), educations: [{ id: 'a', school: '甲大学', major: '电子工程' }, { id: 'b', school: '乙大学', major: '计算机' }], skillEntries: [{ id: 's', label: '实时系统', value: 'FreeRTOS' }] };
  assert.equal(sectionHasContent('教育经历', resume), true);
  assert.equal(sectionHasContent('技能', resume), true);
  assert.equal(resumeCompletion(resume).steps[1], true);
  const parsed = parseResumeBackup(createBackup({ resume, settings: { template: 'academic' }, order: SECTION_ORDER }));
  assert.equal(parsed.resume.educations.length, 2);
  assert.deepEqual(parsed.resume.skillEntries, resume.skillEntries);
  assert.equal(parsed.settings.template, 'academic');
  const reduced = { ...resume, educations: [], skillEntries: [] };
  assert.equal(sectionHasContent('教育经历', reduced), false);
  assert.equal(sectionHasContent('技能', reduced), false);
});
test('internships, publications and awards survive backup and can be omitted when empty', () => {
  const resume = { ...blank(), internships: [{ id: 'i1', company: '某科技公司', position: '嵌入式实习生', description: '参与固件开发' }], publications: [{ id: 'p1', title: '控制系统研究', authors: '甲、乙', venue: '学术会议' }], awards: [{ id: 'a1', title: '电子设计竞赛一等奖', issuer: '组委会' }] };
  for (const name of ['实习经历', '发表论文', '得奖情况']) assert.equal(sectionHasContent(name, resume), true);
  const restored = parseResumeBackup(createBackup({ resume, settings: {}, order: SECTION_ORDER }));
  assert.deepEqual(restored.resume.internships, resume.internships);
  assert.deepEqual(restored.resume.publications, resume.publications);
  assert.deepEqual(restored.resume.awards, resume.awards);
  const empty = { ...resume, internships: [], publications: [], awards: [] };
  for (const name of ['实习经历', '发表论文', '得奖情况']) assert.equal(sectionHasContent(name, empty), false);
  assert.deepEqual(normalizeResumeCollections(blank()).internships, []);
});
test('malformed and oversized imports fail before changing state', () => {
  const invalid = ['oops', 'null', '{}', '{"resume":{"basics":[]}}', '{"resume":{"projects":[null]}}', '{"resume":{"skills":{"languages":[]}}}', '{"resume":{"educations":[null]}}', '{"resume":{"internships":[{"company":42}]}}', '{"resume":{"publications":[null]}}', '{"resume":{"awards":[{"date":false}]}}', '{"resume":{"skillEntries":[{"label":7}]}}', '{"version":2,"resume":{}}', '{"resume":{"project":{"achievements":[{}]}}}', '{"resume":{"basics":{"photo":"https://example.com/photo.png"}}}'];
  for (const value of invalid) assert.throws(() => parseResumeBackup(value));
  assert.throws(() => parseResumeBackup(' '.repeat(8 * 1024 * 1024 + 1)), /8 MB/);
});
test('bad stored data is not overwritten on read; storage quota failure is reported', () => {
  let raw = 'broken', writes = 0;
  const storage = { getItem: () => raw, setItem: () => { writes++; } };
  const loaded = readStoredResume(storage);
  assert.equal(loaded.state, null);
  assert.ok(loaded.error);
  assert.equal(writes, 0);
  assert.equal(saveResume({ setItem() { throw new Error('QuotaExceededError'); } }, { resume: blank() }), false);
  assert.ok(readStoredResume({ getItem() { throw new Error('SecurityError'); } }).error);
  assert.equal(saveResume({ setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; } }, { resume: blank() }), true);
  assert.ok(readStoredResume({ getItem: () => raw }).state);
});

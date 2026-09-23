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
test('malformed and oversized imports fail before changing state', () => {
  const invalid = ['oops', 'null', '{}', '{"resume":{"basics":[]}}', '{"resume":{"projects":[null]}}', '{"resume":{"skills":{"languages":[]}}}', '{"resume":{"educations":[null]}}', '{"resume":{"skillEntries":[{"label":7}]}}', '{"version":2,"resume":{}}', '{"resume":{"project":{"achievements":[{}]}}}', '{"resume":{"basics":{"photo":"https://example.com/photo.png"}}}'];
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

import test from 'node:test';
import assert from 'node:assert/strict';
import mini from '../miniprogram/utils/resume.js';
import { createBackup as webBackup } from '../src/resumeData.js';

test('blank mini resume starts with editable rows and no visible content', () => {
  const state = mini.initialState();
  assert.equal(state.resume.educations.length, 1);
  assert.equal(state.resume.projects.length, 1);
  assert.equal(state.resume.skillEntries.length, 4);
  assert.equal(mini.completion(state.resume), 0);
  assert.deepEqual(mini.visibleSections(state), []);
});

test('mini program imports web backups with multiple education and skill rows', () => {
  const state = mini.initialState();
  state.resume.basics.name = '测试同学';
  state.resume.educations = [{ id: 'e1', school: '测试大学', major: '电子工程', degree: '本科', startDate: '2023.09', endDate: '2027.06', location: '' }];
  state.resume.skillEntries = [{ id: 's1', label: '嵌入式', value: 'STM32、FreeRTOS' }, { id: 's2', label: '语言', value: 'C' }];
  state.resume.projects = [{ id: 'p1', name: '测试项目', role: '开发', startDate: '2026.03', endDate: '2026.06', description: '完成通信模块。', achievements: ['完成联调'] }];
  state.settings.template = 'academic';
  const imported = mini.parseBackup(webBackup(state));
  assert.equal(imported.resume.educations[0].school, '测试大学');
  assert.equal(imported.resume.skillEntries.length, 2);
  assert.equal(imported.settings.template, 'academic');
  assert.match(mini.plainText(imported), /测试项目/);
  assert.equal(mini.completion(imported.resume), 67);
});

test('legacy single education and fixed skills migrate to editable collections', () => {
  const imported = mini.parseBackup(JSON.stringify({ resume: { basics: { name: '测试同学' }, education: { school: '旧版学校', major: '电子工程' }, skills: { languages: 'C', embedded: 'STM32' }, skillLabels: { embedded: '单片机' } }, settings: { template: 'modern' } }));
  assert.equal(imported.resume.educations[0].school, '旧版学校');
  assert.deepEqual(imported.resume.skillEntries.filter((row) => row.value).map((row) => row.label), ['编程语言', '单片机']);
  assert.equal(imported.settings.template, 'modern');
});

test('mini backup stays compatible and import rejects external photos', () => {
  const state = mini.initialState();
  const roundTrip = mini.parseBackup(mini.createBackup(state));
  assert.equal(roundTrip.resume.skillEntries.length, 4);
  assert.throws(() => mini.parseBackup(JSON.stringify({ resume: { basics: { photo: 'https://example.com/photo.png' } } })), /照片/);
  assert.throws(() => mini.parseBackup('not json'), /JSON/);
});

test('native editor handlers add, edit and persist collection rows', async () => {
  let definition;
  const storage = new Map();
  const app = { globalData: { account: { id: 'openid-a', revision: 0, serverDraft: null }, initialDraft: null } };
  globalThis.Page = (page) => { definition = page; };
  globalThis.getApp = () => app;
  globalThis.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => { storage.set(key, value); },
    showToast: () => {},
    pageScrollTo: () => {},
    cloud: { callFunction: async () => ({ result: { ok: true, revision: 1 } }) }
  };
  try {
    await import('../miniprogram/pages/editor/editor.js');
    const page = {
      ...definition,
      data: structuredClone(definition.data),
      setData(patch, callback) {
        for (const [path, value] of Object.entries(patch)) {
          const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
          let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part];
          target[parts.at(-1)] = value;
        }
        callback?.();
      }
    };
    page.onLoad();
    page.onBasicInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '测试同学' } });
    page.addEducation();
    page.onEducationInput({ currentTarget: { dataset: { index: 1, field: 'school' } }, detail: { value: '第二所大学' } });
    page.addSkill();
    page.onSkillInput({ currentTarget: { dataset: { index: 4, field: 'label' } }, detail: { value: '实时系统' } });
    page.persist();
    assert.equal(page.data.resume.educations[1].school, '第二所大学');
    assert.equal(page.data.resume.skillEntries[4].label, '实时系统');
    assert.equal(JSON.parse(JSON.parse(storage.get(mini.userStorageKey('openid-a'))).draftJson).resume.basics.name, '测试同学');
    assert.equal(storage.has(mini.STORAGE_KEY), false);
    clearTimeout(page.saveTimer);
    clearTimeout(page.cloudTimer);
  } finally {
    delete globalThis.Page;
    delete globalThis.getApp;
    delete globalThis.wx;
  }
});

test('login can choose the cloud draft without losing an unsynced device draft', async () => {
  let definition;
  const cloudDraft = JSON.stringify(mini.initialState());
  const localState = mini.initialState();
  localState.resume.basics.name = '本机版本';
  const localDraft = JSON.stringify(localState);
  const storage = new Map([[mini.userStorageKey('openid-a'), JSON.stringify({ draftJson: localDraft, revision: 0, pending: true })]]);
  const app = { globalData: { cloudReady: true, account: null, initialDraft: null } };
  let redirected = '';
  globalThis.Page = (page) => { definition = page; };
  globalThis.getApp = () => app;
  globalThis.wx = {
    cloud: { callFunction: async () => ({ result: { ok: true, accountId: 'openid-a', draftJson: cloudDraft, revision: 2 } }) },
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    showModal: ({ success }) => success({ confirm: false }),
    redirectTo: ({ url }) => { redirected = url; }
  };
  try {
    await import('../miniprogram/pages/login/login.js');
    const page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
    await page.signIn();
    assert.equal(redirected, '/pages/editor/editor');
    assert.equal(app.globalData.initialDraft, cloudDraft);
    assert.equal(storage.has(mini.userStorageKey('openid-a')), false);
    assert.equal(JSON.parse(storage.get(`${mini.userStorageKey('openid-a')}:backup`)).draftJson, localDraft);
  } finally {
    delete globalThis.Page;
    delete globalThis.getApp;
    delete globalThis.wx;
  }
});

test('preview reads and updates only the signed-in account cache', async () => {
  let definition;
  const state = mini.initialState();
  state.resume.basics.name = '账号 A';
  const storage = new Map([[mini.userStorageKey('a'), JSON.stringify({ draftJson: JSON.stringify(state), revision: 3, pending: false })]]);
  const app = { globalData: { account: { id: 'a', revision: 3 } } };
  globalThis.Page = (page) => { definition = page; };
  globalThis.getApp = () => app;
  globalThis.wx = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    showToast: () => {}
  };
  try {
    await import('../miniprogram/pages/preview/preview.js');
    const page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
    page.onShow();
    assert.equal(page.data.resume.basics.name, '账号 A');
    page.selectTemplate({ currentTarget: { dataset: { template: 'modern' } } });
    const cached = JSON.parse(storage.get(mini.userStorageKey('a')));
    assert.equal(cached.pending, true);
    assert.equal(JSON.parse(cached.draftJson).settings.template, 'modern');
    assert.equal(storage.has(mini.STORAGE_KEY), false);
  } finally {
    delete globalThis.Page;
    delete globalThis.getApp;
    delete globalThis.wx;
  }
});

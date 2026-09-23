import test from 'node:test';
import assert from 'node:assert/strict';
import service from '../cloudfunctions/resumeAccount/service.js';
import mini from '../miniprogram/utils/resume.js';

function database() {
  const rows = new Map();
  const collection = () => ({
    where(query) {
      return {
        limit() { return { get: async () => ({ data: rows.has(query._id) ? [rows.get(query._id)] : [] }) }; },
        update: async ({ data }) => {
          const row = rows.get(query._id);
          if (!row || row.revision !== query.revision) return { stats: { updated: 0 } };
          rows.set(query._id, { ...row, ...data });
          return { stats: { updated: 1 } };
        }
      };
    },
    add: async ({ data }) => {
      if (rows.has(data._id)) throw new Error('duplicate');
      rows.set(data._id, data);
    },
    doc(id) { return { set: async ({ data }) => rows.set(id, { _id: id, ...data }) }; }
  });
  return { collection, rows };
}

test('cloud drafts are isolated by server identity and reject stale revisions', async () => {
  const db = database();
  const draftA = JSON.stringify(mini.initialState());
  const draftB = JSON.stringify(mini.initialState());
  const call = (openid, event) => service.handle({ openid, event, db });
  assert.deepEqual(await call('a', { action: 'login' }), { ok: true, accountId: 'a', draftJson: null, revision: 0, savedAt: null });
  assert.deepEqual(await call('a', { action: 'save', revision: 0, draftJson: draftA }), { ok: true, revision: 1, savedAt: db.rows.get('a').savedAt });
  assert.equal((await call('b', { action: 'login' })).draftJson, null);
  assert.equal((await call('b', { action: 'save', revision: 0, draftJson: draftB })).revision, 1);
  const conflict = await call('a', { action: 'save', revision: 0, draftJson: draftB });
  assert.equal(conflict.code, 'CONFLICT');
  assert.equal(conflict.draftJson, draftA);
  assert.equal((await call('a', { action: 'forceSave', draftJson: draftB })).revision, 2);
  assert.equal((await call('b', { action: 'login' })).draftJson, draftB);
  assert.equal(db.rows.size, 2);
});

test('cloud rejects malformed, oversized, and unauthenticated saves', async () => {
  const db = database();
  const call = (openid, event) => service.handle({ openid, event, db });
  assert.equal((await call('', { action: 'login' })).code, 'UNAUTHENTICATED');
  assert.equal((await call('a', { action: 'save', revision: 0, draftJson: '{' })).code, 'INVALID_DRAFT');
  assert.equal((await call('a', { action: 'save', revision: 0, draftJson: 'x'.repeat(service.MAX_DRAFT_BYTES + 1) })).code, 'DRAFT_TOO_LARGE');
  assert.equal((await call('a', { action: 'save', revision: -1, draftJson: JSON.stringify(mini.initialState()) })).code, 'INVALID_REVISION');
  assert.equal(db.rows.size, 0);
});

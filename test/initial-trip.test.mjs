import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../public/model.js';
import { loadInitialTrip } from '../public/initial-trip.js';

const store = (value = null) => ({ value, getItem() { return this.value; }, setItem(key, next) { this.value = next; } });
const published = () => ({ ...blankState(), revision: 5 });

test('新浏览器载入发布快照，随后保留本机修改和主动清空的内容', async () => {
  const storage = store();
  const first = await loadInitialTrip(storage, async () => published());
  assert.equal(first.state.revision, 5);
  assert.equal(storage.value, first.serialized);
  storage.value = JSON.stringify(blankState());
  const next = await loadInitialTrip(storage, async () => { throw new Error('Must not fetch over saved state'); });
  assert.equal(next.state.revision, 0);
  assert.equal(next.serialized, storage.value);
});

test('下载期间另一标签页保存的内容优先，损坏数据不覆盖', async () => {
  const storage = store();
  const saved = JSON.stringify({ ...blankState(), revision: 9 });
  const result = await loadInitialTrip(storage, async () => { storage.value = saved; return published(); });
  assert.equal(result.state.revision, 9);
  assert.equal(storage.value, saved);
  const broken = store('{broken');
  await assert.rejects(loadInitialTrip(broken, async () => published()));
  assert.equal(broken.value, '{broken');
});

test('发布文件不存在、下载失败或校验失败均不写入空白替代数据', async () => {
  for (const read of [async () => null, async () => { throw new Error('Network'); }, async () => ({ schemaVersion: 999 })]) {
    const storage = store();
    try { await loadInitialTrip(storage, read); } catch {}
    assert.equal(storage.value, null);
  }
});

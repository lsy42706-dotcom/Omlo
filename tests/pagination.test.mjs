import assert from "node:assert/strict";
import test from "node:test";
import { measurePageAnchors, planA4Pages } from "../src/pagination.js";

test("an exact A4 fit remains one page", () => {
  assert.deepEqual(planA4Pages({ contentHeight: 900, pageHeight: 900 }), [
    { start: 0, end: 900, topInset: 0, forced: false },
  ]);
});

test("content continues across as many A4 sheets as needed", () => {
  const pages = planA4Pages({
    contentHeight: 2000,
    pageHeight: 900,
    continuationTop: 50,
    continuationBottom: 50,
    candidates: [400, 800, 1200, 1600],
  });
  assert.deepEqual(pages, [
    { start: 0, end: 800, topInset: 0, forced: false },
    { start: 800, end: 1600, topInset: 50, forced: false },
    { start: 1600, end: 2000, topInset: 50, forced: false },
  ]);
});

test("a heading moves to the next page with its first content", () => {
  const pages = planA4Pages({
    contentHeight: 1200,
    pageHeight: 880,
    candidates: [400, 700, 840, 870],
    protectedRanges: [{ start: 840, end: 900 }],
  });
  assert.equal(pages[0].end, 840);
  assert.equal(pages[1].start, 840);
});

test("an unavoidable cut is flagged and pagination still makes progress", () => {
  const pages = planA4Pages({ contentHeight: 2200, pageHeight: 900 });
  assert.deepEqual(pages.map(({ start, end, forced }) => [start, end, forced]), [
    [0, 900, true], [900, 1800, true], [1800, 2200, false],
  ]);
});

test("empty content still has one blank A4 page", () => {
  assert.deepEqual(planA4Pages({ contentHeight: 0, pageHeight: 900 }), [
    { start: 0, end: 0, topInset: 0, forced: false },
  ]);
});

test("a fractional-pixel remainder is not dropped", () => {
  const pages = planA4Pages({ contentHeight: 900.005, pageHeight: 900 });
  assert.equal(pages.at(-1).end, 900.005);
});

test("rejects page settings that leave no continuation space", () => {
  assert.throws(() => planA4Pages({ contentHeight: 1000, pageHeight: 900, continuationTop: 500, continuationBottom: 400 }), RangeError);
});

test("DOM anchors are converted from a scaled preview into CSS pixels", () => {
  const element = (top, bottom, width = 0) => ({ getBoundingClientRect: () => ({ top, bottom, width }) });
  const root = { ...element(100, 530, 305), offsetWidth: 610, scrollHeight: 1400 };
  const heading = element(250, 260);
  const firstLine = element(270, 285);
  const anchors = measurePageAnchors(root, [heading, firstLine], [[heading, firstLine]]);
  assert.deepEqual(anchors, {
    contentHeight: 1400,
    candidates: [300, 340],
    protectedRanges: [{ start: 300, end: 370 }],
  });
});

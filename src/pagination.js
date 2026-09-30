/**
 * Measure possible page breaks in the same CSS-pixel coordinate system as a
 * fixed-width resume page. The root may itself be inside a scaled preview.
 *
 * `guardedNodePairs` contains [heading, firstContentNode] pairs. A page may
 * break at the heading's top, but not between that heading and the end of its
 * first line or entry.
 */
export function measurePageAnchors(root, candidateNodes = [], guardedNodePairs = []) {
  if (!root || typeof root.getBoundingClientRect !== "function") {
    throw new TypeError("A measurable root element is required");
  }

  const rootRect = root.getBoundingClientRect();
  const scale = root.offsetWidth > 0 && rootRect.width > 0 ? rootRect.width / root.offsetWidth : 1;
  const position = (node, edge) => {
    if (!node || typeof node.getBoundingClientRect !== "function") {
      throw new TypeError("Pagination anchors must be measurable elements");
    }
    return (node.getBoundingClientRect()[edge] - rootRect.top) / scale;
  };

  return {
    contentHeight: root.scrollHeight,
    candidates: Array.from(candidateNodes, (node) => position(node, "top")),
    protectedRanges: Array.from(guardedNodePairs, ([heading, firstContent]) => ({
      start: position(heading, "top"),
      end: position(firstContent, "bottom"),
    })),
  };
}

/**
 * Plan consecutive windows into a long resume document. Each window is
 * rendered on its own A4 sheet. Later sheets reserve the requested top and
 * bottom margins; the first sheet already has its own document padding.
 *
 * `candidates` are safe break positions measured from the document top.
 * `protectedRanges` disallow cuts inside a heading/first-content pair.
 * When no safe cut fits, `forced` reports the unavoidable hard cut so callers
 * can expose a warning instead of silently claiming perfect pagination.
 */
export function planA4Pages({
  contentHeight,
  pageHeight,
  candidates = [],
  protectedRanges = [],
  continuationTop = 0,
  continuationBottom = 0,
}) {
  const valid = (value) => Number.isFinite(value) && value >= 0;
  if (![contentHeight, pageHeight, continuationTop, continuationBottom].every(valid)
    || pageHeight <= 0 || continuationTop + continuationBottom >= pageHeight) {
    throw new RangeError("Pagination dimensions must be finite and leave usable page space");
  }

  const epsilon = 0.01;
  const ranges = protectedRanges
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .map(({ start, end }) => ({ start, end }));
  const safeCuts = [...new Set([
    ...candidates.filter(Number.isFinite),
    ...ranges.map(({ start }) => start),
  ])].filter((y) => y > 0 && y < contentHeight).sort((a, b) => a - b);
  const isProtected = (y) => ranges.some(({ start, end }) => y > start + epsilon && y < end - epsilon);
  const pages = [];
  let start = 0;

  do {
    const topInset = pages.length === 0 ? 0 : continuationTop;
    const capacity = pageHeight - topInset - (pages.length === 0 ? 0 : continuationBottom);
    const hardEnd = Math.min(contentHeight, start + capacity);
    let end = hardEnd;
    let forced = false;

    if (hardEnd < contentHeight) {
      const eligible = safeCuts.filter((y) => y > start + epsilon && y <= hardEnd && !isProtected(y));
      if (eligible.length) end = eligible[eligible.length - 1];
      else forced = true;
    }

    pages.push({ start, end, topInset, forced });
    start = end;
  } while (start < contentHeight);

  return pages;
}

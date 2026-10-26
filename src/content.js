(() => {
  if (!document.querySelector('meta[name="generator" i][content^="Bikeshed" i]')) return;

  const SKIP = "script, style, noscript, template, textarea, code, pre, kbd, samp, var, svg, math, c-, .idl, [contenteditable]";
  const BLOCK =
    "address, article, aside, blockquote, body, caption, dd, details, dialog, div, dl, dt, fieldset, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, li, main, nav, ol, p, section, summary, table, td, th, tr, ul";
  let mode;

  // Whole words, any case. "must not", "shall not", "should not" and
  // "not recommended" match as one phrase. "may" with a digit on either side
  // is a date ("26 May 2026", "May 3"), not a key word.
  const KEYWORD_RE =
    /\b(?:must(?:\s+not)?|shall(?:\s+not)?|should(?:\s+not)?|(?:not\s+)?recommended|required|optional)\b|(?<!\d\s*)\bmay\b(?!\s+\d)/gi;

  function isSentenceStart(prefix) {
    // Drop trailing whitespace, opening quotes and opening brackets.
    const before = prefix.replace(/[\s“‘"(\[]+$/u, "");
    // Empty, or only a section number: "2.10.", "§ A.1". A lone letter
    // needs the dot, so "A must" stays mid-sentence.
    if (/^(?:§\s*)?(?:[A-Z](?=\.)|\d+)?(?:\.\d+)*\.?$/.test(before.trim())) return true;
    if (/\b(?:e\.g|i\.e|etc|cf|vs|viz)\.$/i.test(before)) return false;
    // Ends in . ! or ? after something other than a space or quote, then any
    // closing quotes or brackets. 'The string "." shall' does not count.
    return /[^\s“‘"'][.!?][”’"')\]]*$/u.test(before);
  }

  function applyCase(phrase, sentenceStart) {
    switch (mode) {
      case "upper":
        return phrase.toUpperCase();
      case "lower":
        return phrase.toLowerCase();
      case "prose": {
        const lower = phrase.toLowerCase();
        return sentenceStart ? lower[0].toUpperCase() + lower.slice(1) : lower;
      }
      case "alternating": {
        let i = 0;
        return phrase.replace(/[a-z]/gi, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase()));
      }
      default:
        return phrase;
    }
  }

  // Must keep the length of text: recaseBlock maps the result back by offset.
  function recase(text) {
    return text.replace(KEYWORD_RE, (phrase, offset) =>
      applyCase(phrase, mode === "prose" && isSentenceStart(text.slice(0, offset))),
    );
  }

  const rewritten = new WeakMap();

  function originalText(node) {
    const entry = rewritten.get(node);
    return entry && entry.written === node.data ? entry.original : node.data;
  }

  function segmentsByBlock(root) {
    const blocks = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const skipped = node.nodeType === Node.ELEMENT_NODE && node.matches(SKIP);
      if (skipped || node.nodeType === Node.TEXT_NODE) {
        const block = node.parentElement.closest(BLOCK);
        if (!blocks.has(block)) blocks.set(block, []);
        blocks.get(block).push(skipped ? node.textContent : node);
      }
      node = skipped ? nextOutside(walker) : walker.nextNode();
    }
    return blocks.values();
  }

  function nextOutside(walker) {
    while (!walker.nextSibling()) {
      if (!walker.parentNode()) return null;
    }
    return walker.currentNode;
  }

  function recaseBlock(segments) {
    const originals = segments.map((segment) => (typeof segment === "string" ? segment : originalText(segment)));
    const recased = recase(originals.join(""));
    let offset = 0;
    segments.forEach((segment, i) => {
      const original = originals[i];
      const written = recased.slice(offset, offset + original.length);
      offset += original.length;
      if (typeof segment === "string") return;
      if (segment.data !== written) segment.data = written;
      if (written === original) rewritten.delete(segment);
      else rewritten.set(segment, { original, written });
    });
  }

  function recaseUnder(root) {
    if (root.closest(SKIP)) return;
    for (const segments of segmentsByBlock(root)) recaseBlock(segments);
  }

  const observer = new MutationObserver((records) => {
    const roots = new Set();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(BLOCK)) roots.add(node);
        else if (node.parentElement) roots.add(node.parentElement.closest(BLOCK));
      }
    }
    for (const root of roots) if (root.isConnected) recaseUnder(root);
  });

  browser.storage.sync.get({ mode: "upper" }).then((stored) => {
    mode = stored.mode;
    recaseUnder(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  });

  browser.storage.onChanged.addListener((changes) => {
    if (!changes.mode) return;
    mode = changes.mode.newValue;
    recaseUnder(document.body);
  });
})();

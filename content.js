(() => {
    console.log("Claim Highlighter starting");

    // ----------------------------
    // 1️⃣ Create modal
    // ----------------------------
    const modal = document.createElement("div");
    modal.id = "claim-modal";
    Object.assign(modal.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#fff",
        color: "#000",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: "10000",
        display: "none",
        maxWidth: "400px",
        fontSize: "14px",
        lineHeight: "1.4",
        cursor: "default"
    });
    document.body.appendChild(modal);

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "✖";
    Object.assign(closeBtn.style, {
        position: "absolute",
        top: "5px",
        right: "8px",
        cursor: "pointer",
        fontWeight: "bold"
    });
    modal.appendChild(closeBtn);
    closeBtn.addEventListener("click", () => modal.style.display = "none");

    document.addEventListener("mouseover", e => {
        if (e.target.classList.contains("highlighted-claim")) {
            modal.textContent = e.target.dataset.info || "Claim info";
            modal.appendChild(closeBtn);
            modal.style.display = "block";
        }
    });

    document.addEventListener("mouseout", e => {
        if (e.target.classList.contains("highlighted-claim")) {
            modal.style.display = "none";
        }
    });

    // ----------------------------
    // 2️⃣ Universal multi-node claim highlighter
    // ----------------------------
    // helper: escape regex special chars
    function escapeForRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // helper: better visibility check
    function isElementVisible(el) {
        if (!el || !(el instanceof Element)) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) return false;
        // element must have at least one client rect (visible on page)
        const rects = el.getClientRects();
        return rects && rects.length > 0;
    }

    // improved highlight across nodes
    function highlightClaimAcrossNodes(claimText, color = 'yellow') {
        if (!claimText || !claimText.trim()) return;

        // normalize claim: remove zero-width chars
        const normalizedClaim = claimText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        if (!normalizedClaim) return;

        // Build node list (text nodes that are visible)
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        if (nodes.length === 0) return;

        // Build fullText with a single space between nodes to avoid word squashing
        let fullText = '';
        const nodeMap = []; // { node, start, end }
        nodes.forEach((node, idx) => {
            const start = fullText.length;
            // keep original nodeValue (no trimming) but normalize zero-width
            const txt = node.nodeValue.replace(/[\u200B-\u200D\uFEFF]/g, '');
            // ensure a single space between nodes
            fullText += txt;
            if (idx !== nodes.length - 1) fullText += ' ';
            const end = fullText.length;
            nodeMap.push({ node, start, end });
        });

        // build regex from claim: escape, then turn internal whitespace runs into \s+
        const escaped = escapeForRegex(normalizedClaim).replace(/\s+/g, '\\s+');
        const re = new RegExp(escaped, 'iu'); // i = case-insensitive, u = unicode

        // find all matches (global)
        const matches = [];
        let m;
        // Use sticky-like loop by advancing lastIndex manually to avoid infinite loops
        let lastIndex = 0;
        while (lastIndex <= fullText.length) {
            re.lastIndex = lastIndex;
            m = re.exec(fullText);
            if (!m) break;
            const matchIndex = m.index;
            const matchText = m[0];
            matches.push({ index: matchIndex, text: matchText });
            lastIndex = matchIndex + (matchText.length || 1);
            // safety guard
            if (matches.length > 1000) break;
        }

        if (matches.length === 0) {
            // no matches found — useful to debug
            // console.log('No regex matches for claim:', claimText);
            return;
        }

        // Prepare per-node segments so we replace each node only once
        const segmentsPerNode = new Map(); // node -> [{startInNode, endInNode, text}]

        matches.forEach(match => {
            const matchStart = match.index;
            const matchEnd = match.index + match.text.length;
            // which nodes intersect this match?
            nodeMap.forEach(({ node, start, end }) => {
                if (end <= matchStart || start >= matchEnd) return; // no overlap
                const nodeClaimStart = Math.max(matchStart - start, 0);
                const nodeClaimEnd = Math.min(matchEnd - start, node.nodeValue.length);
                if (nodeClaimEnd <= nodeClaimStart) return;
                if (!segmentsPerNode.has(node)) segmentsPerNode.set(node, []);
                segmentsPerNode.get(node).push({
                    start: nodeClaimStart,
                    end: nodeClaimEnd,
                    claimText: match.text
                });
            });
        });

        // Now replace nodes — process each node once; sort segments desc so indices don't shift
        segmentsPerNode.forEach((segments, node) => {
            // merge overlapping or adjacent segments just in case
            segments.sort((a, b) => a.start - b.start);
            const merged = [];
            for (const seg of segments) {
                if (!merged.length) {
                    merged.push(Object.assign({}, seg));
                } else {
                    const last = merged[merged.length - 1];
                    if (seg.start <= last.end) {
                        // overlap/adjacent -> extend end to max
                        last.end = Math.max(last.end, seg.end);
                    } else {
                        merged.push(Object.assign({}, seg));
                    }
                }
            }
            // replace from end to start of node text
            const original = node.nodeValue;
            const frag = document.createDocumentFragment();
            let cursor = 0;
            merged.forEach(seg => {
                const before = original.slice(cursor, seg.start);
                if (before) frag.appendChild(document.createTextNode(before));

                const span = document.createElement('span');
                span.textContent = original.slice(seg.start, seg.end);
                span.style.backgroundColor = color;
                span.style.padding = '1px 2px';
                span.style.cursor = 'pointer';
                span.classList.add('highlighted-claim');
                span.dataset.info = claimText;
                frag.appendChild(span);

                cursor = seg.end;
            });
            // tail
            const tail = original.slice(cursor);
            if (tail) frag.appendChild(document.createTextNode(tail));

            // perform replacement (only if parent exists)
            if (node.parentNode) node.parentNode.replaceChild(frag, node);
        });
    }

    // ----------------------------
    // 3️⃣ Extract visible text (for sending to backend)
    // ----------------------------
    function getVisibleText() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node, text = "";
        while ((node = walker.nextNode())) {
            if (node.parentElement && node.parentElement.offsetParent !== null) {
                const trimmed = node.nodeValue.trim();
                if (trimmed.length > 0) text += trimmed + " ";
            }
        }
        return text;
    }

    function chunkText(text, size = 3000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.slice(i, i + size));
        }
        return chunks;
    }

    // ----------------------------
    // 4️⃣ Send to backend and highlight claims
    // ----------------------------
    const fullText = getVisibleText();
    const chunks = chunkText(fullText);

    chrome.runtime.sendMessage({
        type: "PROCESS_CHUNKS",
        url: window.location.href,
        chunks
    }, (response) => {
        if (!response || !response.rawClaims || response.rawClaims.length === 0) {
            console.log("No claims returned by backend");
            return;
        }

        console.log("Claims received:", response.rawClaims);

        // Highlight each claim robustly
        response.rawClaims.forEach(c => highlightClaimAcrossNodes(c.originalClaim));
    });

})();

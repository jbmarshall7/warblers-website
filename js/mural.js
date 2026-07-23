/* ============================================================
   Warblers Meadery — Communal mural (demo)
   One big shared wall: a 12-column grid of square tiles on a
   forest-green board. A visitor drags out a small rectangle of
   free tiles to claim it, then draws and/or signs it in an editor
   card and submits.

   ONE CONTINUOUS WALL: patches carry no tile chrome and drawings are
   saved with TRANSPARENT backgrounds, so every stroke sits directly
   on the shared parchment. While drawing, the editor canvas shows
   what's already on the wall beneath the claimed patch, so visitors
   can draw right up against (or onto) their neighbours.

   OVERLAP & LAYERING: claims may overlap existing patches. Stacking
   order is simply the regions array order (later = on top, newest
   lands on top). The admin can curate the stack with Bring forward /
   Send back on any approved patch.

   HOLD-UNTIL-APPROVED: every submission is held for a human. A
   pending patch is visible ONLY to its owner (and the admin) as a
   hatched outline — its artwork and words never render for the
   public. An admin opens the page with ?admin=1 to approve, reject
   or take patches down. Approved patches get a small flag/report
   button so the flock can police the wall too.

   PATCH LIMIT: a visitor gets a persistent random id and may hold up
   to MAX_PER_VISITOR active patches (pending or approved). Admin
   removal/rejection frees them up.

   STORAGE SEAM: all persistence lives behind the MuralStore object.
   Today it is a localStorage DEMO — single browser, no server. To
   go live, swap each MuralStore method for a real backend call (see
   the note above the object); nothing else in this file changes.

   TWEAKABLES: the constants just below — board width (COLS), the
   minimum wall height (MIN_ROWS), the drawing resolution (CELL_PX)
   and the claim size limits (MIN/MAX_W/H).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- tweakable constants ---------- */
  var COLS = 12;        // board columns
  var MIN_ROWS = 8;     // board never shows fewer rows
  var CELL_PX = 90;     // internal canvas pixels per cell (drawing resolution)
  var MAX_W = 4, MAX_H = 3, MIN_W = 2, MIN_H = 2;  // claim size limits in cells
  var MAX_PER_VISITOR = 8;  // active patches one visitor may hold (pending + approved)
  var KEY = "warblers_mural_v1";
  var VISITOR_KEY = "warblers_mural_visitor";
  var PAPER = "#FBF7EA";

  /* friendly copy reused in a couple of places */
  var LIMIT_MSG = "That's " + MAX_PER_VISITOR + " patches from one songbird — leave a little wall for the rest of the flock. One frees up if yours is taken down.";
  var FALLBACK_HINT = "Drag anywhere on the wall to claim your patch.";

  /* ---------- backend mode ----------
     With Supabase configured (js/config.js) the wall is SHARED: approved
     patches come from the database, submissions go to it, and moderation
     moves to the real signed-in admin at /admin.html. Without config,
     everything below falls back to the original localStorage demo. */
  var REMOTE = !!(window.SupaLite && window.SupaLite.configured());
  var PENDING_KEY  = "warblers_mural_my_pending_v1";  // local echo of my in-review patches
  var REPORTED_KEY = "warblers_mural_reported_v1";    // patches I've already reported

  /* small inline flag icon for the report button (static — never user data) */
  var FLAG_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">' +
    '<path d="M6 21V4M6 4h11l-2 4 2 4H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- tiny helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { var el = document.createElement("span"); el.textContent = s == null ? "" : String(s); return el.innerHTML; }
  function uid() { return "mr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------- visitor identity (persistent random id) ---------- */
  function visitorId() {
    var id = "";
    try { id = localStorage.getItem(VISITOR_KEY) || ""; } catch (e) {}
    if (!id) {
      id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(VISITOR_KEY, id); } catch (e) {}
    }
    return id;
  }

  /* ============================================================
     MuralStore — THE storage seam.
     Everything the mural knows about persistence lives here. Right
     now it is a synchronous localStorage demo. To ship, replace each
     method body with a fetch() to a real API (the methods can become
     promise-returning; callers already re-read data after every
     mutation and re-render). Keep the data shape and the seeds and
     the rest of the file carries over untouched.

       all()        -> data object (loads, seeds on first run)
       submit(r)    -> add a pending region
       approve(id)  -> flip a region to approved
       reject(id)   -> delete a pending region (frees its cells)
       remove(id)   -> delete any region (frees its cells)
       flag(id)     -> mark a region reported

     Data model (localStorage, versioned):
       { version:1, seeded:true, regions:[ { id, status, col,row,w,h,
         art, text, name, flagged, ts, visitor } ] }   // cells 0-based
     Rejected/removed regions are dropped from the array outright.
     ============================================================ */
  var DemoStore = (function () {
    var data = null; // in-memory cache; the localStorage copy is the record of truth

    function blank() { return { version: 1, seeded: false, regions: [] }; }

    function load() {
      try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.regions) return d; } catch (e) {}
      return blank();
    }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} return data; }

    /* First run: pin two friendly text patches so the wall isn't bare. */
    function seed() {
      data.seeded = true;
      data.regions.push(
        { id: uid(), status: "approved", col: 1, row: 1, w: 3, h: 2,
          art: null, text: "The Warblers flock ♪", name: "", flagged: false, ts: Date.now(), visitor: "seed" },
        { id: uid(), status: "approved", col: 7, row: 4, w: 3, h: 2,
          art: null, text: "Pour something bright", name: "Milo & June", flagged: false, ts: Date.now(), visitor: "seed" }
      );
    }
    function ensure() {
      if (!data) {
        data = load();
        if (!data.seeded) { seed(); persist(); }
      }
      return data;
    }

    return {
      all: function () { return ensure(); },
      submit: function (region) { ensure().regions.push(region); return persist(); },
      approve: function (id) {
        ensure().regions.forEach(function (r) { if (r.id === id) r.status = "approved"; });
        return persist();
      },
      reject: function (id) { return this.remove(id); },
      remove: function (id) {
        ensure();
        data.regions = data.regions.filter(function (r) { return r.id !== id; });
        return persist();
      },
      flag: function (id) {
        ensure().regions.forEach(function (r) { if (r.id === id) r.flagged = true; });
        return persist();
      },
      /* layering: array order IS the z-order (later = on top). The admin
         curates overlaps by moving a region to the front or the back. */
      reorder: function (id, toFront) {
        ensure();
        var idx = data.regions.findIndex(function (r) { return r.id === id; });
        if (idx === -1) return data;
        var r = data.regions.splice(idx, 1)[0];
        if (toFront) data.regions.push(r); else data.regions.unshift(r);
        return persist();
      }
    };
  })();

  /* ============================================================
     RemoteStore — the SHARED wall (Supabase). Same interface as
     DemoStore. Approved patches load from the database (already in
     z-order); the visitor's own pending patches are echoed from
     localStorage so they can see "in review" (anonymous visitors
     can't read pending rows — the server forbids it). Moderation
     methods are no-ops here: that power lives at /admin.html with
     a real sign-in, enforced by row-level security.
     ============================================================ */
  function fromServer(r) {
    return { id: r.id, status: r.status, col: r.x, row: r.y, w: r.w, h: r.h,
             art: r.art, text: r.text || "", name: r.name || "", flagged: false,
             ts: Date.parse(r.created_at) || Date.now(), visitor: r.visitor };
  }
  function toServer(r) {
    return { status: "pending", x: r.col, y: r.row, w: r.w, h: r.h,
             art: r.art, text: r.text, name: r.name, visitor: r.visitor };
  }
  function myPending() {
    try {
      var a = JSON.parse(localStorage.getItem(PENDING_KEY));
      if (Array.isArray(a)) {
        // drop stale echoes (rejected long ago, or approved and replaced)
        var fresh = a.filter(function (p) { return Date.now() - p.ts < 14 * 864e5; });
        return fresh;
      }
    } catch (e) {}
    return [];
  }
  function savePending(a) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(a)); } catch (e) {} }

  var RemoteStore = {
    _cache: { regions: [] },
    all: function () { return this._cache; },
    refresh: function () {
      var self = this;
      return SupaLite.select("mural_regions?select=*&status=eq.approved&order=z.asc&order=created_at.asc")
        .then(function (rows) {
          var approved = (rows || []).map(fromServer);
          // my pending echoes vanish once a matching patch is approved
          var pend = myPending().filter(function (p) {
            return !approved.some(function (a) {
              return a.col === p.col && a.row === p.row && a.w === p.w && a.h === p.h;
            });
          });
          savePending(pend);
          self._cache.regions = approved.concat(pend);
        });
    },
    submit: function (region) {
      savePending(myPending().concat([region]));
      this._cache.regions.push(region);
      SupaLite.insert("mural_regions", toServer(region))["catch"](function () {
        hint("Couldn't reach the wall just now — your patch is saved on this device; try again later.");
      });
      return this._cache;
    },
    flag: function (id) {
      SupaLite.insert("mural_flags", { region_id: id })["catch"](function () {});
      return this._cache;
    },
    /* moderation happens at /admin.html in shared mode */
    approve: function () { return this._cache; },
    reject: function () { return this._cache; },
    remove: function () { return this._cache; },
    reorder: function () { return this._cache; }
  };

  var MuralStore = REMOTE ? RemoteStore : DemoStore;

  /* remember which patches this visitor already reported (cosmetic) */
  function wasReported(id) {
    try { return (JSON.parse(localStorage.getItem(REPORTED_KEY)) || []).indexOf(id) !== -1; } catch (e) { return false; }
  }
  function rememberReported(id) {
    try {
      var a = JSON.parse(localStorage.getItem(REPORTED_KEY)) || [];
      if (a.indexOf(id) === -1) a.push(id);
      localStorage.setItem(REPORTED_KEY, JSON.stringify(a));
    } catch (e) {}
  }

  /* ---------- occupancy helpers ----------
     Overlap is ALLOWED on the wall (patches layer). areaFree() is only used
     to steer the "pick a spot for me" button toward open parchment first. */
  function rectsOverlap(a, b) {
    return a.col < b.col + b.w && b.col < a.col + a.w &&
           a.row < b.row + b.h && b.row < a.row + a.h;
  }
  function areaFree(rect) {
    var regions = MuralStore.all().regions;
    for (var i = 0; i < regions.length; i++) {
      if (rectsOverlap(rect, regions[i])) return false;
    }
    return true;
  }
  function visitorPatchCount() {
    var me = visitorId();
    return MuralStore.all().regions.filter(function (r) { return r.visitor === me; }).length;
  }
  function atPatchLimit() { return visitorPatchCount() >= MAX_PER_VISITOR; }

  /* ============================================================
     Board rendering
     ============================================================ */
  var board;                 // #mural-board
  var activeSelect = null;   // the .mural-select outline (drag preview / claimed patch)
  var activeRect = null;     // the claimed rect once the editor is open

  /* the board has a real grid gap, so a cell's pitch is track + gap */
  function gapPx() {
    var g = parseFloat(getComputedStyle(board).columnGap);
    return isFinite(g) ? g : 4;
  }
  function cellSize() { return (board.clientWidth - (COLS - 1) * gapPx()) / COLS; }

  /* rows = MIN_ROWS, or two spare rows past the deepest occupied cell */
  function boardRows() {
    var deepest = 0;
    MuralStore.all().regions.forEach(function (r) { if (r.row + r.h > deepest) deepest = r.row + r.h; });
    return Math.max(MIN_ROWS, deepest + 2);
  }

  /* place any element on the grid from a {col,row,w,h} rect */
  function positionEl(el, r) {
    el.style.gridArea = (r.row + 1) + " / " + (r.col + 1) + " / span " + r.h + " / span " + r.w;
  }

  /* keep cells square, and give the wall enough height to show its rows */
  function sizeBoard() {
    var cs = cellSize(), g = gapPx(), rows = boardRows();
    board.style.gridAutoRows = cs + "px";
    board.style.minHeight = (rows * cs + (rows - 1) * g) + "px";
    // line the faint free-tile texture up with the real cell pitch
    board.style.setProperty("--mural-cell", (cs + g) + "px");
  }

  function renderBoard() {
    if (!board) return;
    sizeBoard();
    board.innerHTML = "";
    var me = visitorId();
    // DOM order follows array order, so later regions naturally stack on top
    MuralStore.all().regions.forEach(function (r) {
      var el = regionEl(r, me);
      if (el) board.appendChild(el);
    });
    // a claimed outline survives a re-render while the editor is open
    if (activeRect) showSelect(activeRect);
  }

  /* one wall layer for a region — never leaks pending art/text to the public.
     Returns null for pending patches that aren't the visitor's own (only the
     owner and the admin can see a patch while it waits for review). */
  function regionEl(r, me) {
    var mine = r.visitor === me;
    var el = document.createElement("div");

    if (r.status === "pending") {
      if (!mine && !isAdmin) return null;
      el.className = "mural-region mural-region--pending";
      var lab = document.createElement("span");
      lab.className = "mural-reserved-label";
      lab.textContent = mine ? "Yours — in review" : "In review";
      el.appendChild(lab);
      positionEl(el, r);
      return el;
    }

    // approved
    el.className = "mural-region" + (mine ? " mural-region--mine" : "");
    if (isAdmin) el.className += " mural-region--adminview";
    if (isAdmin && r.flagged) el.className += " mural-region--flagged";

    if (r.art) {
      el.className += " mural-region--draw";
      var img = document.createElement("img");
      img.src = r.art;
      img.alt = "Mural drawing" + (r.name ? " by " + r.name : "");
      el.appendChild(img);
      if (r.text || r.name) {
        var cap = document.createElement("span");
        cap.className = "mural-caption";
        cap.textContent = captionText(r);
        el.appendChild(cap);
      }
    } else {
      el.className += " mural-region--text";
      var txt = document.createElement("span");
      txt.className = "mural-text";
      txt.textContent = r.text;
      if (r.name) {
        var nm = document.createElement("span");
        nm.className = "mural-name";
        nm.textContent = "— " + r.name;
        txt.appendChild(nm);
      }
      el.appendChild(txt);
    }
    el.appendChild(flagButton(r));
    positionEl(el, r);
    return el;
  }

  /* caption under a drawing: "words — name", or just one of them */
  function captionText(r) {
    var parts = [];
    if (r.text) parts.push(r.text);
    if (r.name) parts.push("— " + r.name);
    return parts.join(" ");
  }

  /* report button on approved patches */
  function flagButton(r) {
    var btn = document.createElement("button");
    btn.className = "mural-flag";
    btn.type = "button";
    btn.setAttribute("aria-label", "Report this patch");
    btn.innerHTML = FLAG_SVG;
    if (r.flagged || wasReported(r.id)) { btn.setAttribute("aria-label", "Reported — thank you"); btn.disabled = true; }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      MuralStore.flag(r.id);
      rememberReported(r.id);
      btn.setAttribute("aria-label", "Reported — thank you");
      btn.disabled = true;
    });
    return btn;
  }

  /* ============================================================
     Selection outline (drag preview + claimed patch)
     ============================================================ */
  function showSelect(rect) {
    if (!activeSelect) activeSelect = document.createElement("div");
    if (activeSelect.parentNode !== board) board.appendChild(activeSelect);
    activeSelect.className = "mural-select";
    positionEl(activeSelect, rect);
  }
  function clearSelect() {
    if (activeSelect && activeSelect.parentNode) activeSelect.parentNode.removeChild(activeSelect);
    activeSelect = null;
  }

  /* ============================================================
     Claiming — pointer drag on the board (mouse AND touch)
     ============================================================ */
  var dragging = false;
  var anchor = null; // the cell the drag started on

  /* pointer position -> board cell (geometry only; no upper row clamp) */
  function cellFromPoint(x, y) {
    var rect = board.getBoundingClientRect();
    var pitch = cellSize() + gapPx(); // track + gap on both axes
    return {
      col: clamp(Math.floor((x - rect.left) / pitch), 0, COLS - 1),
      row: Math.max(0, Math.floor((y - rect.top) / pitch))
    };
  }

  /* rectangle spanning anchor..current, clamped to MAX size toward the anchor */
  function rectFromAnchor(a, c) {
    var col = Math.min(a.col, c.col);
    var row = Math.min(a.row, c.row);
    var w = Math.abs(c.col - a.col) + 1;
    var h = Math.abs(c.row - a.row) + 1;
    if (w > MAX_W) { w = MAX_W; col = (c.col < a.col) ? a.col - (MAX_W - 1) : a.col; }
    if (h > MAX_H) { h = MAX_H; row = (c.row < a.row) ? a.row - (MAX_H - 1) : a.row; }
    if (col < 0) col = 0;
    if (col + w > COLS) col = COLS - w; // keep inside the columns
    if (row < 0) row = 0;
    return { col: col, row: row, w: w, h: h };
  }

  function onBoardDown(e) {
    if (e.target.closest && e.target.closest(".mural-flag")) return; // let report buttons work
    if (activeRect) return;                       // editor already open with a claim
    if (atPatchLimit()) { hint(LIMIT_MSG); return; }
    dragging = true;
    anchor = cellFromPoint(e.clientX, e.clientY);
    showSelect(rectFromAnchor(anchor, anchor));
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  function onBoardMove(e) {
    if (!dragging) return;
    showSelect(rectFromAnchor(anchor, cellFromPoint(e.clientX, e.clientY)));
    e.preventDefault();
  }
  function onBoardUp(e) {
    if (!dragging) return;
    dragging = false;
    try { board.releasePointerCapture(e.pointerId); } catch (err) {}
    var rect = growToMin(rectFromAnchor(anchor, cellFromPoint(e.clientX, e.clientY)));
    showSelect(rect); // keep it as the claimed outline
    openEditor(rect);
  }

  /* does a rect stay on the board (no upper row bound — the wall grows)? */
  function fits(r) {
    return r.col >= 0 && r.row >= 0 && r.col + r.w <= COLS && r.w >= 1 && r.h >= 1;
  }
  /* grow one dimension up to the target: try the far edge, then the near edge.
     Overlap is allowed, so only the board bounds constrain growth — a claim
     can always reach MIN_W×MIN_H (the board is ≥ MIN columns wide and rows
     grow downward without limit). */
  function expand(rect, dim, target) {
    var r = { col: rect.col, row: rect.row, w: rect.w, h: rect.h };
    var guard = 0;
    while ((dim === "w" ? r.w : r.h) < target && guard++ < 40) {
      var far = { col: r.col, row: r.row, w: r.w + (dim === "w" ? 1 : 0), h: r.h + (dim === "h" ? 1 : 0) };
      var near = { col: r.col - (dim === "w" ? 1 : 0), row: r.row - (dim === "h" ? 1 : 0),
                   w: r.w + (dim === "w" ? 1 : 0), h: r.h + (dim === "h" ? 1 : 0) };
      if (fits(far)) r = far;
      else if (fits(near)) r = near;
      else break;
    }
    return r;
  }
  /* bring a small selection up to at least MIN_W×MIN_H */
  function growToMin(rect) {
    var r = expand(rect, "w", MIN_W);
    return expand(r, "h", MIN_H);
  }

  /* ---------- accessible non-drag claim (#mural-pick-free) ----------
     Prefers open parchment; if the wall's full it happily overlaps (layers). */
  function pickFree() {
    if (activeRect) return;
    if (atPatchLimit()) { hint(LIMIT_MSG); return; }
    var rect = randomFreeRect(3, 2) || randomFreeRect(MIN_W, MIN_H) || randomAnyRect(3, 2);
    showSelect(rect);
    openEditor(rect);
  }
  /* any random on-board spot (used when there's no free parchment left) */
  function randomAnyRect(w, h) {
    return { col: Math.floor(Math.random() * (COLS - w + 1)),
             row: Math.floor(Math.random() * boardRows()), w: w, h: h };
  }
  /* a random free rectangle of the given size (searches a little past the
     current rows so the wall grows if the visible tiles are full) */
  function randomFreeRect(w, h) {
    var limit = boardRows() + h + 1;
    var spots = [];
    for (var row = 0; row + h <= limit; row++) {
      for (var col = 0; col + w <= COLS; col++) {
        var rect = { col: col, row: row, w: w, h: h };
        if (areaFree(rect)) spots.push(rect);
      }
    }
    return spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
  }

  /* ============================================================
     Editor card — draw and/or sign the claimed patch
     ============================================================ */
  var canvas, cctx;              // #mural-canvas + its 2d context
  var strokes = [];              // stroke stack: [{color,size,points:[{x,y}...]}]
  var pen = { color: "#29301E", size: 6 };
  var hasInk = false;

  function openEditor(rect) {
    activeRect = rect;
    var editor = $("#mural-editor");
    if (!editor) return;
    editor.hidden = false;

    var where = $("#mural-editor-where");
    if (where) where.textContent = rect.w + " × " + rect.h + " tiles · row " + (rect.row + 1);

    if (canvas) {
      canvas.width = rect.w * CELL_PX;
      canvas.height = rect.h * CELL_PX; // resizing resets the context, so re-set caps + repaint
      cctx.lineJoin = cctx.lineCap = "round";
    }
    strokes = [];
    hasInk = false;
    repaint();

    if ($("#mural-text")) $("#mural-text").value = "";
    if ($("#mural-name")) $("#mural-name").value = "";
    setStatus("", "");

    editor.scrollIntoView({ block: "nearest" });
  }

  function closeEditor() {
    var editor = $("#mural-editor");
    if (editor) editor.hidden = true;
    activeRect = null;
    clearSelect();
  }
  function cancelEditor() {
    closeEditor();
    hint(defaultHint);
  }

  /* ---------- drawing surface ---------- */
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width,
             y: (e.clientY - r.top) * canvas.height / r.height };
  }
  function bindCanvasDrawing() {
    var drawing = false, cur = null;
    canvas.addEventListener("pointerdown", function (e) {
      drawing = true;
      var p = canvasPos(e);
      cur = { color: pen.color, size: pen.size, points: [p] };
      strokes.push(cur);
      cctx.fillStyle = pen.color;                 // a dot for a single click
      cctx.beginPath(); cctx.arc(p.x, p.y, pen.size / 2, 0, 7); cctx.fill();
      hasInk = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing || !cur) return;
      var p = canvasPos(e), last = cur.points[cur.points.length - 1];
      cur.points.push(p);
      cctx.strokeStyle = cur.color; cctx.lineWidth = cur.size;
      cctx.beginPath(); cctx.moveTo(last.x, last.y); cctx.lineTo(p.x, p.y); cctx.stroke();
      hasInk = true;
      e.preventDefault();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { drawing = false; cur = null; });
    });
  }
  /* replay the visitor's strokes onto any context (editor or export) */
  function strokesOnto(ctx2) {
    ctx2.lineJoin = ctx2.lineCap = "round";
    strokes.forEach(function (s) {
      if (s.points.length === 1) {
        var p = s.points[0];
        ctx2.fillStyle = s.color;
        ctx2.beginPath(); ctx2.arc(p.x, p.y, s.size / 2, 0, 7); ctx2.fill();
      } else {
        ctx2.strokeStyle = s.color; ctx2.lineWidth = s.size;
        ctx2.beginPath(); ctx2.moveTo(s.points[0].x, s.points[0].y);
        for (var i = 1; i < s.points.length; i++) ctx2.lineTo(s.points[i].x, s.points[i].y);
        ctx2.stroke();
      }
    });
  }

  /* ---------- underlay: what's already on the wall under this patch ----------
     Approved neighbours are painted beneath the visitor's strokes so they can
     draw with (or against) them — this is what makes the mural continuous.
     The underlay is view-only: the export saves ONLY the visitor's strokes. */
  var artCache = {}; // region id -> Image (dataURL decode is async)

  function drawUnderlay(ctx2, rect) {
    ctx2.fillStyle = PAPER;
    ctx2.fillRect(0, 0, rect.w * CELL_PX, rect.h * CELL_PX);
    MuralStore.all().regions.forEach(function (r) {
      if (r.status !== "approved" || !rectsOverlap(rect, r)) return;
      var x = (r.col - rect.col) * CELL_PX, y = (r.row - rect.row) * CELL_PX;
      var w = r.w * CELL_PX, h = r.h * CELL_PX;
      if (r.art) {
        var img = artCache[r.id];
        if (!img) {
          img = artCache[r.id] = new Image();
          img.onload = repaint; // repaint once the dataURL has decoded
          img.src = r.art;
        }
        if (img.complete && img.naturalWidth) ctx2.drawImage(img, x, y, w, h);
      } else if (r.text) {
        ctx2.fillStyle = "#2E3D20";
        ctx2.font = "600 " + Math.round(h * 0.22) + "px Caveat, cursive";
        ctx2.textAlign = "center"; ctx2.textBaseline = "middle";
        ctx2.fillText(r.text, x + w / 2, y + h / 2, w - 12);
      }
    });
  }

  /* repaint the editor: wall underlay first, the visitor's ink on top */
  function repaint() {
    if (!cctx || !activeRect) return;
    drawUnderlay(cctx, activeRect);
    strokesOnto(cctx);
  }

  /* ---------- editor wiring (bound once at boot) ---------- */
  function initEditor() {
    canvas = $("#mural-canvas");
    if (canvas) {
      cctx = canvas.getContext("2d");
      cctx.lineJoin = cctx.lineCap = "round";
      bindCanvasDrawing();
    }
    $$(".mural-swatch").forEach(function (b) {
      b.addEventListener("click", function () {
        pen.color = b.getAttribute("data-color");
        $$(".mural-swatch").forEach(function (x) { x.classList.toggle("active", x === b); });
      });
    });
    $$(".mural-size").forEach(function (b) {
      b.addEventListener("click", function () {
        pen.size = parseFloat(b.getAttribute("data-size"));
        $$(".mural-size").forEach(function (x) { x.classList.toggle("active", x === b); });
      });
    });
    var undo = $("#mural-undo");
    if (undo) undo.addEventListener("click", function () { strokes.pop(); hasInk = strokes.length > 0; repaint(); });
    var clear = $("#mural-clear");
    if (clear) clear.addEventListener("click", function () { strokes = []; hasInk = false; repaint(); });
    var place = $("#mural-place");
    if (place) place.addEventListener("click", placeRegion);
    var cancel = $("#mural-cancel");
    if (cancel) cancel.addEventListener("click", cancelEditor);
  }

  function setStatus(msg, kind) {
    var el = $("#mural-status");
    if (!el) return;
    if (!msg) { el.className = "form-status"; el.textContent = ""; return; }
    el.className = "form-status show " + (kind === "ok" ? "ok" : "err");
    el.textContent = msg;
  }

  /* submit: build the pending region and hand it to the store */
  function placeRegion() {
    if (!activeRect) return;
    var text = ($("#mural-text") ? $("#mural-text").value : "").trim();
    var name = ($("#mural-name") ? $("#mural-name").value : "").trim();
    if (!hasInk && !text) { setStatus("Draw a little something or leave a signature — either works.", "err"); return; }
    // export ONLY the visitor's strokes on a transparent background, so the
    // patch layers cleanly onto the shared wall (the underlay stays view-only)
    var art = null;
    if (hasInk) {
      var out = document.createElement("canvas");
      out.width = canvas.width; out.height = canvas.height;
      strokesOnto(out.getContext("2d"));
      art = out.toDataURL("image/png");
    }
    var region = {
      id: uid(), status: "pending",
      col: activeRect.col, row: activeRect.row, w: activeRect.w, h: activeRect.h,
      art: art,
      text: text, name: name, flagged: false, ts: Date.now(), visitor: visitorId()
    };
    MuralStore.submit(region);
    closeEditor();
    renderBoard();
    renderAdmin();
    hint("Thanks! Your patch is reserved and off to the flock for review.");
  }

  /* ---------- claim hint line ---------- */
  var defaultHint = FALLBACK_HINT;
  function hint(msg) {
    var el = $("#mural-claim-hint");
    if (el) el.textContent = msg;
  }

  /* ============================================================
     Admin moderation (?admin=1)
     ============================================================ */
  var isAdmin = /[?&]admin=1\b/.test(location.search);

  /* admin sees the real artwork/words (only the public wall is anonymized) */
  function adminThumb(r) {
    if (r.art) {
      return '<div class="mural-admin-thumb"><img src="' + r.art + '" alt="Patch drawing"></div>';
    }
    return '<div class="mural-admin-thumb mural-admin-thumb--sign">' + esc(r.text || r.name || "") + "</div>";
  }
  function adminCard(r, buttons) {
    var who = r.name || r.text || "Anonymous patch";
    var meta = esc(who) + " · " + r.w + " × " + r.h + " tiles · " +
               new Date(r.ts).toLocaleString() + (r.flagged ? " · flagged" : "");
    return '<article class="mural-admin-card">' + adminThumb(r) +
      '<div class="mural-admin-meta">' + meta + "</div>" +
      '<div class="mural-admin-actions">' + buttons + "</div></article>";
  }

  function renderAdmin() {
    if (!isAdmin) return;
    var pendWrap = $("#mural-pending"), apprWrap = $("#mural-approved");
    if (!pendWrap || !apprWrap) return;
    var regions = MuralStore.all().regions;
    var pending = regions.filter(function (r) { return r.status === "pending"; });
    var approved = regions.filter(function (r) { return r.status === "approved"; });

    pendWrap.innerHTML = pending.length
      ? pending.map(function (r) {
          return adminCard(r,
            '<button class="btn" data-approve="' + r.id + '">Approve</button>' +
            '<button class="btn btn--ghost" data-reject="' + r.id + '">Reject</button>');
        }).join("")
      : '<p style="color:var(--ink-soft)">Nothing waiting — the wall is up to date.</p>';

    // approved cards are listed back-to-front; layering buttons curate overlaps
    apprWrap.innerHTML = approved.length
      ? approved.map(function (r) {
          return adminCard(r,
            '<button class="btn btn--ghost" data-front="' + r.id + '">Bring forward</button>' +
            '<button class="btn btn--ghost" data-back="' + r.id + '">Send back</button>' +
            '<button class="btn btn--ghost" data-remove="' + r.id + '">Take down</button>');
        }).join("")
      : '<p style="color:var(--ink-soft)">Nothing on the wall yet.</p>';

    // wire the freshly rendered buttons (ids are generated, safe as attributes)
    $$("[data-approve]", pendWrap).forEach(function (b) {
      b.addEventListener("click", function () { MuralStore.approve(b.getAttribute("data-approve")); afterModerate(); });
    });
    $$("[data-reject]", pendWrap).forEach(function (b) {
      b.addEventListener("click", function () { MuralStore.reject(b.getAttribute("data-reject")); afterModerate(); });
    });
    $$("[data-remove]", apprWrap).forEach(function (b) {
      b.addEventListener("click", function () { MuralStore.remove(b.getAttribute("data-remove")); afterModerate(); });
    });
    $$("[data-front]", apprWrap).forEach(function (b) {
      b.addEventListener("click", function () { MuralStore.reorder(b.getAttribute("data-front"), true); afterModerate(); });
    });
    $$("[data-back]", apprWrap).forEach(function (b) {
      b.addEventListener("click", function () { MuralStore.reorder(b.getAttribute("data-back"), false); afterModerate(); });
    });
  }
  function afterModerate() { renderBoard(); renderAdmin(); }

  /* ============================================================
     Boot
     ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    board = $("#mural-board");
    if (!board) return; // only act on the guestbook/mural page

    var hintEl = $("#mural-claim-hint");
    defaultHint = (hintEl && (hintEl.textContent || "").trim()) || FALLBACK_HINT;

    initEditor();
    board.addEventListener("pointerdown", onBoardDown);
    board.addEventListener("pointermove", onBoardMove);
    board.addEventListener("pointerup", onBoardUp);
    board.addEventListener("pointercancel", function () { if (dragging) { dragging = false; clearSelect(); } });

    var pick = $("#mural-pick-free");
    if (pick) pick.addEventListener("click", pickFree);

    if (REMOTE) {
      // shared wall: server data, real admin at /admin.html — no demo admin here
      isAdmin = false;
      var note = $("#mural-mode-note");
      if (note) note.innerHTML = "<strong>Shared wall.</strong> Everyone sees the same mural — " +
        "your patch appears for the whole flock once it&rsquo;s approved. " +
        'Admins sign in at <a href="/admin">the admin page</a>.';
      renderBoard(); // paint my local echoes immediately…
      RemoteStore.refresh().then(renderBoard)["catch"](function () {
        hint("Couldn't load the wall just now — check back in a moment.");
      });
    } else {
      renderBoard();
    }

    if (isAdmin) {
      var adm = $("#mural-admin");
      if (adm) adm.hidden = false;
      renderAdmin();
    }

    // keep tiles square on resize (regions/selection reflow via grid-area)
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (board) sizeBoard(); }, 150);
    });
  });
})();

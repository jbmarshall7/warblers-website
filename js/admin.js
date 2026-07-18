/* ============================================================
   Warblers Meadery — admin app (admin.html)
   Real sign-in via Supabase Auth; every action here runs with the
   admin's access token and is authorized SERVER-SIDE by the
   row-level-security policies (supabase/schema.sql). Visitors'
   anon key cannot perform any of these operations.

   Sections: pending patches (approve/reject), the wall (take down,
   bring forward / send back for overlap layering, clear reports),
   and the contact-message inbox.
   ============================================================ */
(function () {
  "use strict";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { var el = document.createElement("span"); el.textContent = s == null ? "" : String(s); return el.innerHTML; }

  var regions = [];   // both pending + approved, freshly loaded
  var flags = {};     // region_id -> report count
  var messages = [];

  /* ---------- state switching ---------- */
  function show(state) {
    $("#admin-unconfigured").hidden = state !== "unconfigured";
    $("#admin-login").hidden = state !== "login";
    $("#admin-app").hidden = state !== "app";
  }
  function say(msg, ok) {
    var el = $("#adm-status");
    el.className = msg ? "form-status show " + (ok ? "ok" : "err") : "form-status";
    el.textContent = msg || "";
  }

  /* ---------- data ---------- */
  function loadAll() {
    say("Loading…", true);
    return Promise.all([
      SupaLite.select("mural_regions?select=*&order=z.asc&order=created_at.asc", true),
      SupaLite.select("mural_flags?select=region_id", true),
      SupaLite.select("contact_messages?select=*&order=created_at.desc", true)
    ]).then(function (res) {
      regions = res[0] || [];
      flags = {};
      (res[1] || []).forEach(function (f) { flags[f.region_id] = (flags[f.region_id] || 0) + 1; });
      messages = res[2] || [];
      say("");
      renderAll();
    }).catch(function (e) {
      say(e.message, false);
      if (!SupaLite.session()) show("login");
    });
  }

  function maxZ() { return regions.reduce(function (m, r) { return Math.max(m, r.z || 0); }, 0); }
  function minZ() { return regions.reduce(function (m, r) { return Math.min(m, r.z || 0); }, 0); }

  /* ---------- rendering ---------- */
  function card(r, buttons) {
    var reports = flags[r.id] || 0;
    var thumb = r.art
      ? '<div class="mural-admin-thumb"><img src="' + r.art + '" alt="Patch drawing"></div>'
      : '<div class="mural-admin-thumb mural-admin-thumb--sign">' + esc(r.text || r.name || "") + "</div>";
    var who = r.name || r.text || "Anonymous patch";
    var meta = esc(who) + " · " + r.w + " × " + r.h + " tiles · " +
      new Date(r.created_at).toLocaleString() +
      (reports ? ' · <strong style="color:var(--danger)">' + reports + " report" + (reports > 1 ? "s" : "") + "</strong>" : "");
    return '<article class="mural-admin-card' + (reports ? ' mural-region--flagged' : '') + '">' + thumb +
      '<div class="mural-admin-meta">' + meta + "</div>" +
      '<div class="mural-admin-actions">' + buttons + "</div></article>";
  }

  function renderAll() {
    var pending = regions.filter(function (r) { return r.status === "pending"; });
    var wall = regions.filter(function (r) { return r.status === "approved"; });

    $("#adm-pending").innerHTML = pending.length
      ? pending.map(function (r) {
          return card(r,
            '<button class="btn" data-act="approve" data-id="' + r.id + '">Approve</button>' +
            '<button class="btn btn--ghost" data-act="delete" data-id="' + r.id + '">Reject</button>');
        }).join("")
      : '<p style="color:var(--ink-soft)">Nothing waiting — the wall is up to date.</p>';

    $("#adm-wall").innerHTML = wall.length
      ? wall.map(function (r) {
          return card(r,
            '<button class="btn btn--ghost" data-act="front" data-id="' + r.id + '">Bring forward</button>' +
            '<button class="btn btn--ghost" data-act="back" data-id="' + r.id + '">Send back</button>' +
            ((flags[r.id] || 0) ? '<button class="btn btn--ghost" data-act="clearflags" data-id="' + r.id + '">Clear reports</button>' : '') +
            '<button class="btn btn--ghost" data-act="delete" data-id="' + r.id + '">Take down</button>');
        }).join("")
      : '<p style="color:var(--ink-soft)">Nothing on the wall yet.</p>';

    $("#adm-messages").innerHTML = messages.length
      ? messages.map(function (m) {
          return '<article class="mural-admin-card" style="margin-bottom:1rem">' +
            '<div class="mural-admin-meta"><strong>' + esc(m.name) + '</strong> · ' +
            '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a> · " + esc(m.reason) +
            "<br><small>" + new Date(m.created_at).toLocaleString() + "</small>" +
            '<p style="margin:0.5rem 0 0;white-space:pre-wrap">' + esc(m.message) + "</p></div>" +
            '<div class="mural-admin-actions"><button class="btn btn--ghost" data-act="delmsg" data-id="' + m.id + '">Delete</button></div>' +
            "</article>";
        }).join("")
      : '<p style="color:var(--ink-soft)">No messages yet.</p>';

    // wire all action buttons (ids are server-generated uuids, safe as attributes)
    $$("#admin-app [data-act]").forEach(function (b) {
      b.addEventListener("click", function () { act(b.getAttribute("data-act"), b.getAttribute("data-id"), b); });
    });
  }

  /* ---------- moderation actions (server-authorized) ---------- */
  function act(action, id, btn) {
    btn.disabled = true;
    var p;
    if (action === "approve")    p = SupaLite.patch("mural_regions?id=eq." + id, { status: "approved", z: maxZ() + 1 });
    else if (action === "front") p = SupaLite.patch("mural_regions?id=eq." + id, { z: maxZ() + 1 });
    else if (action === "back")  p = SupaLite.patch("mural_regions?id=eq." + id, { z: minZ() - 1 });
    else if (action === "delete") p = SupaLite.del("mural_regions?id=eq." + id);       // flags cascade
    else if (action === "clearflags") p = SupaLite.del("mural_flags?region_id=eq." + id);
    else if (action === "delmsg") p = SupaLite.del("contact_messages?id=eq." + id);
    else return;
    p.then(loadAll).catch(function (e) { btn.disabled = false; say(e.message, false); });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("#admin-app")) return; // not the admin page

    if (!window.SupaLite || !SupaLite.configured()) { show("unconfigured"); return; }

    function enterApp() {
      show("app");
      $("#adm-user").textContent = SupaLite.userEmail();
      loadAll();
    }

    if (SupaLite.session()) enterApp(); else show("login");

    $("#admin-login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var status = $("#adm-login-status");
      status.className = "form-status"; status.textContent = "";
      var btn = $("#adm-signin"); btn.disabled = true;
      SupaLite.signIn($("#adm-email").value.trim(), $("#adm-pass").value)
        .then(function () { btn.disabled = false; enterApp(); })
        .catch(function (err) {
          btn.disabled = false;
          status.className = "form-status show err";
          status.textContent = err.message;
        });
    });

    $("#adm-signout").addEventListener("click", function () { SupaLite.signOut(); show("login"); });
    $("#adm-refresh").addEventListener("click", loadAll);
  });
})();

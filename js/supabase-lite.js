/* ============================================================
   SupaLite — a tiny Supabase REST client (vanilla JS, no deps).
   Written in-house so the site's Content-Security-Policy can stay
   `script-src 'self'` (no CDN scripts). Talks to two Supabase APIs:

     /auth/v1  — email+password sign-in for the admin (GoTrue)
     /rest/v1  — the database over PostgREST; every request carries
                 either the public anon key (visitors) or the
                 admin's access token. What each may do is enforced
                 SERVER-SIDE by the row-level-security policies in
                 supabase/schema.sql — nothing here is trusted.

   Sessions persist in localStorage and auto-refresh before expiry.
   Configured automatically from js/config.js at load.
   ============================================================ */
(function () {
  "use strict";

  var URL = "", KEY = "";
  var SESSION_KEY = "warblers_admin_session_v1";

  function configured() { return !!(URL && KEY); }

  /* ---------- session persistence ---------- */
  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s && s.access_token) return s;
    } catch (e) {}
    return null;
  }
  function saveSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  /* ---------- auth ---------- */
  function tokenRequest(body) {
    var grant = body.refresh_token ? "refresh_token" : "password";
    return fetch(URL + "/auth/v1/token?grant_type=" + grant, {
      method: "POST",
      headers: { "apikey": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error_description || j.msg || "Sign-in failed");
        j.expires_at = Date.now() + (j.expires_in || 3600) * 1000;
        saveSession(j);
        return j;
      });
    });
  }
  function signIn(email, password) { return tokenRequest({ email: email, password: password }); }
  function signOut() { saveSession(null); }
  function userEmail() { var s = session(); return (s && s.user && s.user.email) || ""; }

  /* refresh shortly before the access token expires */
  function ensureFresh() {
    var s = session();
    if (!s) return Promise.reject(new Error("Signed out"));
    if (s.expires_at && s.expires_at - Date.now() < 60000 && s.refresh_token) {
      return tokenRequest({ refresh_token: s.refresh_token });
    }
    return Promise.resolve(s);
  }

  /* ---------- database (PostgREST) ---------- */
  /* asAdmin=true sends the signed-in token; otherwise the anon key. */
  function rest(path, opts, asAdmin) {
    opts = opts || {};
    function run() {
      var bearer = asAdmin && session() ? session().access_token : KEY;
      var headers = {
        "apikey": KEY,
        "Authorization": "Bearer " + bearer,
        "Content-Type": "application/json"
      };
      var k; for (k in (opts.headers || {})) headers[k] = opts.headers[k];
      return fetch(URL + "/rest/v1/" + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      }).then(function (r) {
        if (r.status === 401 && asAdmin) { signOut(); throw new Error("Session expired — please sign in again."); }
        if (!r.ok) return r.text().then(function (t) {
          throw new Error("Request failed (" + r.status + "): " + t.slice(0, 160));
        });
        return r.status === 204 ? null : r.json();
      });
    }
    return asAdmin ? ensureFresh().then(run) : run();
  }

  window.SupaLite = {
    configured: configured,
    session: session,
    signIn: signIn,
    signOut: signOut,
    userEmail: userEmail,
    /* query is a PostgREST querystring, e.g. "mural_regions?status=eq.approved&select=*" */
    select: function (query, asAdmin) { return rest(query, {}, asAdmin); },
    insert: function (table, row, asAdmin) {
      return rest(table, { method: "POST", body: row, headers: { "Prefer": "return=minimal" } }, asAdmin);
    },
    patch: function (query, values) {
      return rest(query, { method: "PATCH", body: values, headers: { "Prefer": "return=minimal" } }, true);
    },
    del: function (query) { return rest(query, { method: "DELETE" }, true); }
  };

  /* auto-configure from js/config.js */
  var cfg = window.WARBLERS_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    URL = String(cfg.SUPABASE_URL).replace(/\/+$/, "");
    KEY = String(cfg.SUPABASE_ANON_KEY);
  }
})();

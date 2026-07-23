/* ============================================================
   Warblers Meadery — site behavior
   Age gate · mobile nav · cart drawer · mailing list · contact
   form · quantity pickers · shipping-state check (compliance).
   Vanilla JS, no dependencies. Cart persists in localStorage.
   ============================================================ */
(function () {
  "use strict";

  var STORE_KEY = "warblers_cart_v1";
  var GATE_KEY = "warblers_age_ok";

  /* ---------- tiny helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function money(n) { return "$" + Number(n).toFixed(2); }
  function products() { return window.WARBLERS_PRODUCTS || []; }
  function merch() { return window.WARBLERS_MERCH || []; }
  function allItems() { return products().concat(merch()); }
  function findProduct(id) { return allItems().filter(function (p) { return p.id === id; })[0]; }

  /* Decorative bottle-of-mead SVG for a given hue. Pure decoration
     (aria-hidden) — real product photography replaces these. */
  function bottleSVG(hue) {
    hue = hue || "#E8A33D";
    return '' +
      '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF5E9"/><stop offset="1" stop-color="#F4E9D4"/></linearGradient>' +
        '<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hue + '"/><stop offset="1" stop-color="#C97E1E"/></linearGradient>' +
      '</defs>' +
      '<rect width="400" height="500" fill="url(#bg)"/>' +
      '<circle cx="200" cy="235" r="150" fill="#ffffff" opacity="0.35"/>' +
      '<g transform="translate(200 250)">' +
        '<rect x="-34" y="-150" width="68" height="300" rx="30" fill="url(#liq)"/>' +
        '<rect x="-16" y="-210" width="32" height="70" rx="8" fill="url(#liq)"/>' +
        '<rect x="-20" y="-222" width="40" height="18" rx="5" fill="#2B2620"/>' +
        '<rect x="-34" y="-40" width="68" height="140" rx="10" fill="#FBF5E9" opacity="0.92"/>' +
        '<rect x="-34" y="-150" width="20" height="300" rx="20" fill="#ffffff" opacity="0.25"/>' +
        '<path d="M0 -8 q10 12 0 24 q-10 -12 0 -24" fill="' + hue + '"/>' +
      '</g>' +
      '<path d="M120 120 q14 -18 30 -4 q10 -14 24 -2 q-2 16 -20 22 q-22 4 -34 -16z" fill="' + hue + '" opacity="0.55"/>' +
      '</svg>';
  }
  window.warblersBottle = bottleSVG;

  /* Decorative merch tile SVG (glassware/apparel/accessory). */
  function merchSVG(hue) {
    hue = hue || "#C9D64B";
    return '' +
      '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBF5E9"/><stop offset="1" stop-color="#F4E9D4"/></linearGradient></defs>' +
      '<rect width="400" height="500" fill="url(#mg)"/>' +
      '<circle cx="200" cy="250" r="140" fill="' + hue + '" opacity="0.5"/>' +
      '<g transform="translate(200 250)" fill="none" stroke="#2B2620" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">' +
        '<path d="M-70 -70 h140 l-14 150 a56 40 0 0 1 -112 0 z"/>' +
        '<path d="M0 130 v50 M-40 180 h80"/>' +
      '</g>' +
      '<path d="M150 120 q14 -18 30 -4 q10 -14 24 -2 q-2 16 -20 22 q-22 4 -34 -16z" fill="#2B2620" opacity="0.55"/>' +
      '</svg>';
  }
  function itemThumb(p) {
    // real product photo when we have one, otherwise the decorative placeholder
    if (p && p.image) return '<img class="thumb-img" src="' + p.image + '" alt="' + (p.name || "") + '" loading="lazy">';
    return p && p.kind ? merchSVG(p.hue) : bottleSVG(p.hue);
  }

  /* Small warbler icon markup (used where inline needed). */
  function birdSVG() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 6c-1.5 0-3 .7-4 2-1-2.5-3.4-4-6-4C7.6 4 4 7.6 4 12c0 1.2.3 2.3.8 3.3L3 20l4.7-1.8C9 18.7 10.5 19 12 19c4.4 0 8-3.6 8-8 0-.5 0-1-.1-1.4C20.7 8.9 21.5 8 22 7l-1-1z" fill="currentColor"/><circle cx="15.5" cy="9.5" r="1.1" fill="#2B2620"/></svg>';
  }

  /* ============================================================
     AGE GATE (spec §7 — before store/product access)
     Pages that require it carry <body data-agegate="true">.
     ============================================================ */
  function initAgeGate() {
    var body = document.body;
    var needsGate = body.getAttribute("data-agegate") === "true";
    var gate = $("#agegate");
    if (!gate) return;

    var passed = false;
    try { passed = sessionStorage.getItem(GATE_KEY) === "1" || localStorage.getItem(GATE_KEY) === "1"; } catch (e) {}

    if (!needsGate || passed) { gate.hidden = true; return; }

    gate.hidden = false;
    body.style.overflow = "hidden";

    var confirmBtn = $(".gate-confirm", gate);
    var declineBtn = $(".gate-decline", gate);
    var remember = $(".gate-remember", gate);

    function pass() {
      try {
        sessionStorage.setItem(GATE_KEY, "1");
        if (remember && remember.checked) localStorage.setItem(GATE_KEY, "1");
      } catch (e) {}
      gate.hidden = true;
      body.style.overflow = "";
    }
    if (confirmBtn) confirmBtn.addEventListener("click", pass);
    if (declineBtn) declineBtn.addEventListener("click", function () { gate.classList.add("denied"); });
  }

  /* ============================================================
     MOBILE NAV
     ============================================================ */
  function initNav() {
    var toggle = $(".nav-toggle");
    var links = $(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ============================================================
     CART (localStorage) + drawer
     ============================================================ */
  function readCart() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeCart(c) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) {}
    renderCart();
  }
  function cartCount(c) {
    c = c || readCart();
    return Object.keys(c).reduce(function (n, k) { return n + c[k]; }, 0);
  }
  function cartTotal(c) {
    c = c || readCart();
    return Object.keys(c).reduce(function (sum, id) {
      var p = findProduct(id); return sum + (p ? p.price * c[id] : 0);
    }, 0);
  }
  function addToCart(id, qty) {
    var p = findProduct(id);
    if (!p) return;
    if (p.availability === "soldout" || p.availability === "soon") return;
    var c = readCart();
    c[id] = (c[id] || 0) + (qty || 1);
    writeCart(c);
    openCart();
  }
  function setQty(id, qty) {
    var c = readCart();
    if (qty <= 0) { delete c[id]; } else { c[id] = qty; }
    writeCart(c);
  }

  function renderCart() {
    var c = readCart();
    // badge(s)
    $$(".cart-count").forEach(function (el) {
      var n = cartCount(c);
      el.textContent = n;
      el.setAttribute("data-count", n);
    });
    var wrap = $(".cart-items");
    if (!wrap) return;
    var ids = Object.keys(c);
    if (!ids.length) {
      wrap.innerHTML = '<div class="cart-empty"><p>Your cart is empty.</p><p style="font-size:.9rem">Browse the <a href="/shop">mead lineup</a> to get started.</p></div>';
    } else {
      wrap.innerHTML = ids.map(function (id) {
        var p = findProduct(id); if (!p) return "";
        var q = c[id];
        return '<div class="cart-line" data-id="' + id + '">' +
          '<div class="cart-thumb">' + itemThumb(p) + '</div>' +
          '<div><div class="name">' + p.name + '</div>' +
            '<div class="qty"><button class="dec" aria-label="Decrease quantity">−</button><span>' + q + '</span><button class="inc" aria-label="Increase quantity">+</button></div>' +
            '<button class="remove">Remove</button></div>' +
          '<div class="price">' + money(p.price * q) + '</div>' +
        '</div>';
      }).join("");
    }
    var totalEl = $(".cart-total .amount");
    if (totalEl) totalEl.textContent = money(cartTotal(c));
    var checkoutBtn = $(".cart-checkout");
    if (checkoutBtn) checkoutBtn.disabled = ids.length === 0;
  }

  function openCart() {
    var d = $(".cart-drawer"), o = $(".cart-overlay");
    if (d) d.classList.add("open");
    if (o) o.classList.add("open");
  }
  function closeCart() {
    var d = $(".cart-drawer"), o = $(".cart-overlay");
    if (d) d.classList.remove("open");
    if (o) o.classList.remove("open");
  }

  function initCart() {
    renderCart();
    $$("[data-open-cart]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openCart(); }); });
    var closeBtn = $(".cart-close"), overlay = $(".cart-overlay");
    if (closeBtn) closeBtn.addEventListener("click", closeCart);
    if (overlay) overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });

    // delegate qty / remove inside drawer
    var items = $(".cart-items");
    if (items) items.addEventListener("click", function (e) {
      var line = e.target.closest(".cart-line"); if (!line) return;
      var id = line.getAttribute("data-id");
      var c = readCart();
      if (e.target.classList.contains("inc")) setQty(id, (c[id] || 0) + 1);
      else if (e.target.classList.contains("dec")) setQty(id, (c[id] || 0) - 1);
      else if (e.target.classList.contains("remove")) setQty(id, 0);
    });

    // Note: add-to-cart buttons are bound where they're rendered
    // (renderCatalog / renderProductPage) to avoid double-binding.

    var checkoutBtn = $(".cart-checkout");
    if (checkoutBtn) checkoutBtn.addEventListener("click", function () { openCheckout(); });
  }

  /* ============================================================
     CHECKOUT (demo) — enforces the compliance gates from spec §7
     Real payment/tax/carrier integration is platform-dependent
     and out of scope for this static build; this demonstrates the
     required *logic*: 21+ affirmation, allowed-state restriction,
     adult-signature notice, no PO box.
     ============================================================ */
  function openCheckout() {
    var modal = $("#checkout"); if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderCheckoutSummary();
  }
  function closeCheckout() {
    var modal = $("#checkout"); if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }
  function renderCheckoutSummary() {
    var el = $("#checkout-summary"); if (!el) return;
    var c = readCart();
    el.innerHTML = Object.keys(c).map(function (id) {
      var p = findProduct(id); if (!p) return "";
      return '<div class="co-line"><span>' + p.name + ' × ' + c[id] + '</span><span>' + money(p.price * c[id]) + '</span></div>';
    }).join("") + '<div class="co-line co-total"><span>Total</span><span>' + money(cartTotal(c)) + '</span></div>';
  }
  function initCheckout() {
    var modal = $("#checkout"); if (!modal) return;
    // populate state selector
    var sel = $("#co-state");
    if (sel && window.WARBLERS_US_STATES) {
      sel.innerHTML = '<option value="">Select state…</option>' +
        window.WARBLERS_US_STATES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("");
    }
    $$("[data-close-checkout]").forEach(function (b) { b.addEventListener("click", closeCheckout); });

    var form = $("#checkout-form");
    var stateMsg = $("#co-state-msg");
    var allowed = window.WARBLERS_ALLOWED_STATES || [];

    /* fulfillment: ship (CT only) or local pickup in Newtown */
    var shipFields = $("#co-ship-fields"), pickupInfo = $("#co-pickup-info");
    function method() {
      var r = modal.querySelector('input[name="co-method"]:checked');
      return r ? r.value : "ship";
    }
    function syncMethod() {
      var pickup = method() === "pickup";
      if (shipFields) shipFields.hidden = pickup;
      if (pickupInfo) pickupInfo.hidden = !pickup;
      var addr = $("#co-address");
      if (addr) addr.required = !pickup;
      if (sel) sel.required = !pickup;
    }
    $$('input[name="co-method"]', modal).forEach(function (r) {
      r.addEventListener("change", syncMethod);
    });
    syncMethod();

    function checkState() {
      var v = sel ? sel.value : "";
      if (!v) { stateMsg.className = "co-state-msg"; stateMsg.textContent = ""; return true; }
      if (allowed.indexOf(v) === -1) {
        stateMsg.className = "co-state-msg err show";
        stateMsg.innerHTML = "We’re not able to ship mead to that state yet. " +
          "<a href=\"#\" data-join-list>Join the mailing list</a> and we’ll tell you the moment we can — or find us at a local stockist.";
        return false;
      }
      stateMsg.className = "co-state-msg ok show";
      stateMsg.textContent = "Good news — we can ship to your state. Adult signature (21+) required on delivery.";
      return true;
    }
    if (sel) sel.addEventListener("change", checkState);

    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = $("#checkout-status");
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var pickup = method() === "pickup";

      if (!pickup) {
        // shipping-only rules: no PO boxes, allowed-state check
        var addr = ($("#co-address") ? $("#co-address").value : "").toLowerCase();
        if (/p\.?\s*o\.?\s*box|post office box/.test(addr)) {
          status.className = "form-status err show";
          status.textContent = "We can’t ship mead to a PO box — please use a street address (adult signature required on delivery).";
          return;
        }
        if (!checkState()) {
          status.className = "form-status err show";
          status.textContent = "Please choose a shipping destination we currently serve — or switch to local pickup.";
          return;
        }
      }
      var age = $("#co-21");
      if (age && !age.checked) {
        status.className = "form-status err show";
        status.textContent = "Please confirm you are 21 or older to complete this order.";
        return;
      }
      // success (demo)
      status.className = "form-status ok show";
      status.innerHTML = pickup
        ? "Thanks! This is a demonstration checkout — no payment was taken. A real order would confirm here " +
          "with pickup details for <strong>3 Simm Ln, Newtown, CT</strong> — we’d email you to arrange a time. " +
          "<strong>Photo ID (21+) checked at pickup.</strong>"
        : "Thanks! This is a demonstration checkout — no payment was taken. " +
          "A real order would confirm here, noting <strong>adult signature (21+) required on delivery</strong>. " +
          "Payment, tax and carrier setup come with the chosen store platform.";
      writeCart({}); // clear
      renderCheckoutSummary();
    });

    // "join list" links inside checkout jump to footer signup
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-join-list]")) {
        e.preventDefault();
        closeCheckout();
        var ml = $("#mailing-list-input") || $(".newsletter input");
        if (ml) { ml.scrollIntoView({ behavior: "smooth", block: "center" }); ml.focus(); }
      }
    });
  }

  /* ============================================================
     FORMS — mailing list + contact (front-end only demo)
     These need a real backend/provider on launch; here they
     validate and show a friendly confirmation.
     ============================================================ */
  function initForms() {
    $$("form[data-mailing]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector("input[type=email]");
        var status = form.querySelector(".form-status") || form.parentElement.querySelector(".form-status");
        if (input && !input.checkValidity()) { input.reportValidity(); return; }
        if (status) { status.className = "form-status ok show"; status.textContent = "You’re on the list — thanks for joining the flock. (Demo: connect an email provider to go live.)"; }
        form.reset();
      });
    });

    var contact = $("#contact-form");
    if (contact) contact.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = $("#contact-status");
      // honeypot spam trap
      var hp = $("#contact-company");
      if (hp && hp.value) { return; } // bot filled hidden field
      if (!contact.checkValidity()) { contact.reportValidity(); return; }

      // With Supabase configured, messages go to the real inbox (admin.html).
      // Server-side rules only allow inserting — visitors can never read them.
      if (window.SupaLite && SupaLite.configured()) {
        var btn = contact.querySelector("button[type=submit]");
        if (btn) btn.disabled = true;
        SupaLite.insert("contact_messages", {
          name: contact.querySelector("#c-name").value.trim(),
          email: contact.querySelector("#c-email").value.trim(),
          reason: contact.querySelector("#c-reason").value || "General question",
          message: contact.querySelector("#c-message").value.trim()
        }).then(function () {
          if (btn) btn.disabled = false;
          status.className = "form-status ok show";
          status.textContent = "Thanks for reaching out — your message is in our inbox. We’ll get back to you within 2–3 business days.";
          contact.reset();
        })["catch"](function () {
          if (btn) btn.disabled = false;
          status.className = "form-status err show";
          status.textContent = "Something went wrong sending that — please try again, or email us directly.";
        });
        return;
      }

      status.className = "form-status ok show";
      status.textContent = "Thanks for reaching out — we’ll get back to you within 2–3 business days. (Demo: connect a form backend to receive messages.)";
      contact.reset();
    });
  }

  /* ============================================================
     PRODUCT DETAIL quantity picker
     ============================================================ */
  function initQtyPickers() {
    $$(".qty-picker").forEach(function (pick) {
      var input = pick.querySelector("input");
      pick.querySelector(".qminus").addEventListener("click", function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); });
      pick.querySelector(".qplus").addEventListener("click", function () { input.value = (parseInt(input.value, 10) || 1) + 1; });
    });
  }

  /* ============================================================
     SHOP grid + featured render (from catalog data)
     ============================================================ */
  var AVAIL = {
    stock:   { label: "In stock",  cls: "badge--stock" },
    limited: { label: "Limited",   cls: "badge--limited" },
    soldout: { label: "Sold out",  cls: "badge--soldout" },
    soon:    { label: "Coming soon", cls: "badge--soon" }
  };
  function productCard(p) {
    var a = AVAIL[p.availability] || AVAIL.stock;
    var buyable = p.availability === "stock" || p.availability === "limited";
    return '<article class="product-card">' +
      '<a class="product-thumb" href="/product?id=' + p.id + '" aria-label="' + p.name + '">' + bottleSVG(p.hue) + '</a>' +
      '<div class="product-body">' +
        '<div class="product-style">' + p.style + ' · ' + p.abv + '% ABV</div>' +
        '<h3><a href="/product?id=' + p.id + '" style="text-decoration:none;color:inherit">' + p.name + '</a></h3>' +
        '<p class="product-char">' + p.character + '</p>' +
        '<div class="product-meta">' +
          '<span class="product-price">' + money(p.price) + '</span>' +
          '<span class="badge ' + a.cls + '">' + a.label + '</span>' +
        '</div>' +
        (buyable
          ? '<button class="btn btn--block" data-add="' + p.id + '" style="margin-top:1rem">Add to cart</button>'
          : '<a class="btn btn--ghost btn--block" href="/product?id=' + p.id + '" style="margin-top:1rem">View details</a>') +
      '</div>' +
    '</article>';
  }
  function renderCatalog() {
    var shop = $("#shop-grid");
    if (shop) shop.innerHTML = products().map(productCard).join("");
    var featured = $("#featured-grid");
    if (featured) featured.innerHTML = products().slice(0, 3).map(productCard).join("");
    // rebind add buttons for freshly rendered cards
    $$("[data-add]", shop || document).forEach(bindAdd);
    if (featured) $$("[data-add]", featured).forEach(bindAdd);
  }
  function bindAdd(b) {
    if (b._bound) return; b._bound = true;
    b.addEventListener("click", function () { addToCart(b.getAttribute("data-add"), 1); });
  }

  function merchCard(p) {
    var a = AVAIL[p.availability] || AVAIL.stock;
    var buyable = p.availability === "stock" || p.availability === "limited";
    return '<article class="product-card">' +
      '<div class="product-thumb">' + itemThumb(p) + '</div>' +
      '<div class="product-body">' +
        '<div class="product-style">' + p.kind + '</div>' +
        '<h3>' + p.name + '</h3>' +
        '<p class="product-char">' + p.character + '</p>' +
        '<div class="product-meta">' +
          '<span class="product-price">' + money(p.price) + '</span>' +
          '<span class="badge ' + a.cls + '">' + a.label + '</span>' +
        '</div>' +
        (buyable
          ? '<button class="btn btn--block" data-add="' + p.id + '" style="margin-top:1rem">Add to cart</button>'
          : '<button class="btn btn--ghost btn--block" disabled style="margin-top:1rem">' + a.label + '</button>') +
      '</div>' +
    '</article>';
  }
  function renderMerch() {
    var grid = $("#merch-grid");
    if (!grid) return;
    grid.innerHTML = merch().map(merchCard).join("");
    $$("[data-add]", grid).forEach(bindAdd);
  }

  /* ============================================================
     PRODUCT DETAIL page render (reads ?id=)
     ============================================================ */
  function renderProductPage() {
    var host = $("#pdp"); if (!host) return;
    var params = new URLSearchParams(location.search);
    var p = findProduct(params.get("id")) || products()[0];
    if (!p) { host.innerHTML = "<p>Product not found. <a href='shop.html'>Back to the shop</a>.</p>"; return; }
    document.title = p.name + " — Warblers Meadery";
    var a = AVAIL[p.availability] || AVAIL.stock;
    var buyable = p.availability === "stock" || p.availability === "limited";

    host.innerHTML =
      '<div class="pdp-media">' + bottleSVG(p.hue) + '</div>' +
      '<div class="pdp-info">' +
        '<nav class="crumbs"><a href="/shop">Shop</a> / ' + p.name + '</nav>' +
        '<div class="product-style">' + p.style + ' · ' + p.abv + '% ABV</div>' +
        '<h1>' + p.name + '</h1>' +
        '<p class="lede">' + p.character + '</p>' +
        '<span class="badge ' + a.cls + '">' + a.label + '</span>' +
        (p.placeholder ? '<div class="ph-note"><strong>Placeholder product.</strong> Name, notes, ABV and price are structural stand-ins. Real tasting notes must be confirmed before this goes live (spec §6.3).</div>' : '') +
        '<div class="tasting"><h3>Tasting notes</h3><p>' + p.tasting + '</p></div>' +
        '<ul class="spec-list">' +
          row("Style", p.style) +
          row("ABV", p.abv + "%") +
          row("Honey / ingredients", p.honey) +
          row("Volume", p.volume + " ml") +
          row("Pairing", p.pairing) +
          row("Price", money(p.price)) +
        '</ul>' +
        '<div class="buy-row">' +
          (buyable
            ? '<div class="qty-picker"><button class="qminus" aria-label="Decrease">−</button><input id="pdp-qty" type="number" min="1" value="1" aria-label="Quantity"><button class="qplus" aria-label="Increase">+</button></div>' +
              '<button class="btn" data-add="' + p.id + '" data-qty-source="pdp-qty">Add to cart · ' + money(p.price) + '</button>'
            : '<button class="btn" disabled>' + a.label + '</button>') +
        '</div>' +
        '<p class="ship-eligibility">' + infoIcon() + '<span>Ships within <strong>Connecticut</strong> — adult signature (21+) required on delivery, no PO boxes. Or choose <strong>free local pickup in Newtown, CT</strong> at checkout (photo ID, 21+).</span></p>' +
      '</div>';

    function row(k, v) { return '<li><span class="k">' + k + '</span><span class="v">' + v + '</span></li>'; }
    initQtyPickers();
    $$("[data-add]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var qEl = document.getElementById("pdp-qty");
        addToCart(b.getAttribute("data-add"), qEl ? parseInt(qEl.value, 10) || 1 : 1);
      });
    });
  }
  function infoIcon() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }

  /* ============================================================
     Inject shared interactive chrome (age gate, cart drawer,
     checkout modal). These are JS-only features, so building them
     here keeps the HTML pages lean and consistent. Header/footer
     stay inline in each page for SEO + no-JS robustness.
     ============================================================ */
  function injectChrome() {
    if ($("#agegate")) return; // already present
    var mark = '<svg class="mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + birdSVG().replace(/^<svg[^>]*>|<\/svg>$/g, "") + '</svg>';
    var html = '' +
      // Age gate
      '<div class="agegate" id="agegate" role="dialog" aria-modal="true" aria-labelledby="gate-title" hidden>' +
        '<div class="agegate-card">' +
          '<div class="gate-welcome">' +
            mark +
            '<h2 id="gate-title">Are you 21 or older?</h2>' +
            '<p>You must be of legal drinking age to enter. Warblers Meadery makes and sells mead, an alcoholic beverage.</p>' +
            '<div class="gate-actions">' +
              '<button class="btn gate-confirm">Yes, I’m 21 or older</button>' +
              '<button class="decline gate-decline">No, I’m under 21</button>' +
            '</div>' +
            '<label class="check" style="justify-content:center;margin-top:1rem"><input type="checkbox" class="gate-remember"> Remember me on this device</label>' +
            '<p class="fineprint">By entering you agree that adult signature (21+) is required on delivery of any order. Please enjoy responsibly.</p>' +
          '</div>' +
          '<div class="gate-deny">' +
            mark +
            '<h2>Come back soon</h2>' +
            '<p>You must be 21 or older to visit Warblers Meadery. Thanks for stopping by.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // Cart drawer + overlay
      '<div class="cart-overlay"></div>' +
      '<aside class="cart-drawer" aria-label="Shopping cart">' +
        '<div class="cart-head"><h3>Your cart</h3><button class="cart-close" aria-label="Close cart"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>' +
        '<div class="cart-items"></div>' +
        '<div class="cart-foot">' +
          '<div class="cart-total"><span>Subtotal</span><span class="amount">$0.00</span></div>' +
          '<div class="cart-ship-note">' + infoIcon() + '<span>We ship within Connecticut (adult signature 21+ on delivery) — or free local pickup in Newtown, CT.</span></div>' +
          '<button class="btn btn--block cart-checkout" disabled>Checkout</button>' +
        '</div>' +
      '</aside>' +
      // Checkout modal (demo)
      '<div class="agegate" id="checkout" role="dialog" aria-modal="true" aria-labelledby="co-title" hidden>' +
        '<div class="agegate-card" style="max-width:520px;text-align:left">' +
          '<button class="cart-close" data-close-checkout style="position:absolute;margin:-.5rem 0 0 auto;display:block" aria-label="Close checkout"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
          '<h2 id="co-title" style="text-align:left">Checkout</h2>' +
          '<div class="ph-note"><strong>Demonstration checkout.</strong> No payment is taken. This shows the compliance logic the real store must enforce (spec §7): 21+ affirmation, allowed-state restriction, adult-signature notice, no PO boxes. Payment, tax and carrier setup come with the chosen platform.</div>' +
          '<div id="checkout-summary" class="checkout-summary"></div>' +
          '<form id="checkout-form" novalidate>' +
            '<div class="field"><label for="co-name">Name <span class="req">*</span></label><input id="co-name" required autocomplete="name"></div>' +
            '<div class="field"><label for="co-email">Email <span class="req">*</span></label><input id="co-email" type="email" required autocomplete="email"><span class="hint">For order updates — and to arrange a time if you choose pickup.</span></div>' +
            '<fieldset class="co-fulfill">' +
              '<legend>How would you like your mead?</legend>' +
              '<label class="check"><input type="radio" name="co-method" value="ship" checked> Ship to my address <span class="co-fulfill-hint">(Connecticut only)</span></label>' +
              '<label class="check"><input type="radio" name="co-method" value="pickup"> Local pickup in Newtown, CT <span class="co-fulfill-hint">(free)</span></label>' +
            '</fieldset>' +
            '<div id="co-ship-fields">' +
              '<div class="field"><label for="co-address">Street address <span class="req">*</span></label><input id="co-address" required autocomplete="street-address"><span class="hint">Street address only — we can’t ship mead to PO boxes.</span></div>' +
              '<div class="field"><label for="co-state">Shipping state <span class="req">*</span></label><select id="co-state" required></select><div id="co-state-msg" class="co-state-msg"></div></div>' +
            '</div>' +
            '<div id="co-pickup-info" class="co-pickup-info" hidden>Pickup is at <strong>3 Simm Ln, Newtown, CT</strong>. We’ll email you to arrange a time once your order is ready — bring a photo ID (21+ verified at pickup).</div>' +
            '<label class="check" style="margin:.5rem 0 1rem"><input type="checkbox" id="co-21" required> I confirm I am 21 years of age or older. <span class="req">*</span></label>' +
            '<button type="submit" class="btn btn--block">Place order</button>' +
            '<div id="checkout-status" class="form-status"></div>' +
          '</form>' +
        '</div>' +
      '</div>';
    var div = document.createElement("div");
    div.innerHTML = html;
    while (div.firstChild) document.body.appendChild(div.firstChild);
  }

  /* ---------- optional animated hero background (Home only) ----------
     No-ops unless the hero opts into an animated mode (data-hero-bg is not
     "static"). Pauses the CSS layers when the hero scrolls off-screen, and
     boots the interactive bee swarm when data-hero-bg="bees". */
  function initHeroBg() {
    var hero = $('.hero-brand[data-hero-bg]:not([data-hero-bg="static"])');
    if (!hero) return;
    var anim = $(".hero-anim", hero);
    if (anim && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        anim.classList.toggle("is-paused", !entries[0].isIntersecting);
      }, { threshold: 0 }).observe(hero);
    }
    if ((hero.getAttribute("data-hero-bg") || "").indexOf("bees") !== -1) initHeroBees(hero);
  }

  /* ---------- interactive bees (data-hero-bg="bees") ----------
     Bees wander gently and, when the cursor is over the hero, steer toward it
     and swarm loosely around it. Tweak behaviour with data-attributes on
     <section class="hero-brand"> (defaults in parentheses):
        data-bee-count : how many bees          (4)   e.g. 12 for a big swarm
        data-bee-speed : speed multiplier        (1)   0.5 = lazy, 2 = zippy
        data-bee-follow: cursor pull, 0..1       (0.7) 0 = ignore cursor, 1 = glued
     Skipped entirely for prefers-reduced-motion. The rAF loop pauses itself
     when the hero is off-screen or the tab is hidden. */
  function initHeroBees(hero) {
    var layer = $(".hero-fx-bees", hero);
    if (!layer) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    // ----- config (from data-attributes, with sensible limits) -----
    var COUNT  = Math.round(clamp(num(hero.getAttribute("data-bee-count"), 4), 1, 60));
    var SPEED  = clamp(num(hero.getAttribute("data-bee-speed"), 1), 0.1, 6);
    var FOLLOW = clamp(num(hero.getAttribute("data-bee-follow"), 0.7), 0, 1);
    var CRUISE = 42 * SPEED;   // relaxed wandering speed (px/s)
    var MAXV   = 190 * SPEED;  // top speed, used when chasing the cursor (px/s)
    var TURN   = 2.6;          // how quickly a bee turns toward its target

    var W = 0, H = 0;
    function measure() { W = layer.clientWidth; H = layer.clientHeight; }
    measure();

    // ----- build the bees -----
    layer.innerHTML = "";
    var bees = [];
    for (var i = 0; i < COUNT; i++) {
      var s = 26 + Math.random() * 20;                 // size 26–46px
      var el = document.createElement("span");
      el.className = "bee";
      el.style.width = s + "px";
      el.style.height = (s * 28 / 40) + "px";
      layer.appendChild(el);
      var b = {
        el: el, w: s, h: s * 28 / 40,
        x: Math.random() * Math.max(1, W - s),
        y: Math.random() * Math.max(1, H - s),
        vx: (Math.random() * 2 - 1) * CRUISE,
        vy: (Math.random() * 2 - 1) * CRUISE,
        tx: Math.random() * W, ty: Math.random() * H, // wander target
        retarget: 0, face: 1,
        phase: Math.random() * 6.28, bob: 0.6 + Math.random() * 0.8,
        ang: Math.random() * 6.28, orbit: 22 + Math.random() * 36 // swarm radius around cursor
      };
      // place immediately so the first paint is correct (no corner-stack flash)
      el.style.transform = "translate3d(" + b.x.toFixed(1) + "px," + b.y.toFixed(1) + "px,0)";
      bees.push(b);
    }

    // ----- cursor tracking (relative to the hero) -----
    var ptr = { x: 0, y: 0, on: false, until: 0 };
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      if (px >= 0 && py >= 0 && px <= r.width && py <= r.height) {
        ptr.x = px; ptr.y = py; ptr.on = true;
        ptr.until = performance.now() + 450; // keep chasing briefly after the last move
      }
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { ptr.on = false; });

    // ----- run only while visible & on-screen -----
    var raf = 0, last = 0, onscreen = true, visible = true;
    function kick() {
      var go = onscreen && visible;
      if (go && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { onscreen = en[0].isIntersecting; kick(); }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener("visibilitychange", function () { visible = !document.hidden; kick(); });
    window.addEventListener("resize", measure);

    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var chasing = ptr.on && now < ptr.until;
      for (var i = 0; i < bees.length; i++) {
        var b = bees[i], gx, gy;
        if (chasing) {
          // loosely orbit the cursor, blended with the bee's own wander target
          b.ang += dt * 1.3;
          var cx = ptr.x + Math.cos(b.ang) * b.orbit;
          var cy = ptr.y + Math.sin(b.ang) * b.orbit;
          gx = cx * FOLLOW + b.tx * (1 - FOLLOW);
          gy = cy * FOLLOW + b.ty * (1 - FOLLOW);
        } else {
          // pick a fresh wander target when reached or timed out
          b.retarget -= dt;
          if (b.retarget <= 0 || (Math.abs(b.x - b.tx) < 26 && Math.abs(b.y - b.ty) < 26)) {
            b.tx = 40 + Math.random() * Math.max(1, W - 80);
            b.ty = 24 + Math.random() * Math.max(1, H - 48);
            b.retarget = 2 + Math.random() * 3;
          }
          gx = b.tx; gy = b.ty;
        }
        // steer velocity toward the goal
        var dx = gx - b.x, dy = gy - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var want = chasing ? MAXV : CRUISE;
        var k = Math.min(1, TURN * dt);
        b.vx += (dx / d * want - b.vx) * k;
        b.vy += (dy / d * want - b.vy) * k;
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > MAXV) { b.vx = b.vx / sp * MAXV; b.vy = b.vy / sp * MAXV; }
        // advance, softly bounce off the edges
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
        else if (b.x > W - b.w) { b.x = W - b.w; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        else if (b.y > H - b.h) { b.y = H - b.h; b.vy = -Math.abs(b.vy); }
        // face travel direction (SVG faces right), add a gentle bob + tilt
        if (b.vx > 6) b.face = 1; else if (b.vx < -6) b.face = -1;
        b.phase += dt * (5 + b.bob * 4);
        var yy = b.y + Math.sin(b.phase) * 2.2;
        var tilt = clamp(b.vy * 0.05, -11, 11) * b.face;
        b.el.style.transform = "translate3d(" + b.x.toFixed(1) + "px," + yy.toFixed(1) + "px,0) rotate(" + tilt.toFixed(1) + "deg) scaleX(" + b.face + ")";
      }
      raf = requestAnimationFrame(tick);
    }
    kick();
  }

  /* ============================================================
     APPEARANCES (Find Us + Events) — markets & faires
     Renders window.WARBLERS_APPEARANCES into #appearances-list.
     Empty list -> warm coming-soon card. Data lives in js/data.js.
     ============================================================ */
  function renderAppearances() {
    var wrap = $("#appearances-list");
    if (!wrap) return;
    var items = window.WARBLERS_APPEARANCES || [];
    if (!items.length) {
      wrap.innerHTML = '<div class="appearance-empty">' +
        '<img src="assets/bird-logo.png" alt="" aria-hidden="true">' +
        '<h3>Confirming our first pours now</h3>' +
        '<p>We\u2019re lining up farmers markets and renaissance faires for the season. The moment a date is locked it lands here \u2014 mailing-list folks hear first.</p>' +
        '</div>';
      return;
    }
    wrap.innerHTML = items.map(function (a) {
      var title = a.url ? '<a href="' + a.url + '">' + a.name + "</a>" : a.name;
      return '<article class="appearance-card">' +
        '<div class="appearance-when">' + a.date + (a.time ? " \u00b7 " + a.time : "") + "</div>" +
        "<h3>" + title + "</h3>" +
        "<p>" + (a.place || "") + (a.note ? " \u2014 " + a.note : "") + "</p>" +
      "</article>";
    }).join("");
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    injectChrome();
    initAgeGate();
    initNav();
    initHeroBg();
    renderCatalog();
    renderMerch();
    renderProductPage();
    initCart();
    initCheckout();
    initForms();
    renderAppearances();
    initQtyPickers();
    // set current year
    $$(".js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });
})();

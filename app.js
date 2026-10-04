/* abhilashcr.in — hash router + page-turning books */
(function () {
  "use strict";

  var VIEWS = ["home", "journey", "work", "advisory", "person", "mind", "connect"];
  var books = {};

  /* ---------------- Book ---------------- */

  function Book(root) {
    this.root = root;
    this.pages = Array.prototype.slice.call(root.querySelectorAll(".page"));
    this.prevBtn = root.querySelector("[data-prev]");
    this.nextBtn = root.querySelector("[data-next]");
    this.dotsEl = root.querySelector("[data-dots]");
    this.index = 0;
    this.onChange = null;

    var self = this;
    var n = this.pages.length;

    this.pages.forEach(function (page, i) {
      page.style.zIndex = String(n - i);
      page.setAttribute("aria-label", "Page " + (i + 1) + " of " + n);
    });

    this.dots = this.pages.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Go to page " + (i + 1));
      b.addEventListener("click", function () { self.goTo(i); });
      self.dotsEl.appendChild(b);
      return b;
    });

    this.prevBtn.addEventListener("click", function () { self.prev(); });
    this.nextBtn.addEventListener("click", function () { self.next(); });

    root.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () { self.goTo(Number(el.getAttribute("data-goto"))); });
    });

    // Swipe to turn
    var stage = root.querySelector(".book-stage");
    var sx = 0, sy = 0, tracking = false;
    stage.addEventListener("touchstart", function (e) {
      tracking = true;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dx < 0 ? self.next() : self.prev();
      }
    });

    this.render(false);
  }

  Book.prototype.goTo = function (target) {
    target = Math.max(0, Math.min(this.pages.length - 1, target));
    if (target === this.index) return;
    var from = this.index;
    var forward = target > from;

    // Stagger multi-page jumps so the pages riffle one after another
    this.pages.forEach(function (page, i) {
      var moving = forward ? (i >= from && i < target) : (i >= target && i < from);
      if (moving) {
        var order = forward ? i - from : from - 1 - i;
        page.style.transitionDelay = (order * 110) + "ms";
      } else {
        page.style.transitionDelay = "0ms";
      }
    });

    this.index = target;
    this.render(true);
  };

  Book.prototype.next = function () { this.goTo(this.index + 1); };
  Book.prototype.prev = function () { this.goTo(this.index - 1); };

  Book.prototype.render = function (notify) {
    var idx = this.index;
    this.pages.forEach(function (page, i) {
      page.classList.toggle("turned", i < idx);
      page.setAttribute("aria-hidden", i === idx ? "false" : "true");
      page.inert = i !== idx;
    });
    this.dots.forEach(function (d, i) {
      d.setAttribute("aria-current", i === idx ? "true" : "false");
    });
    this.prevBtn.disabled = idx === 0;
    this.nextBtn.disabled = idx === this.pages.length - 1;
    if (notify && this.onChange) this.onChange(idx);
  };

  /* ---------------- Router ---------------- */

  function parseHash() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var view = VIEWS.indexOf(parts[0]) > -1 ? parts[0] : "home";
    var page = parseInt(parts[1], 10);
    return { view: view, page: isNaN(page) ? null : page - 1 };
  }

  var current = null;

  function route() {
    var r = parseHash();
    var changed = r.view !== current;
    current = r.view;

    document.body.setAttribute("data-view", r.view);
    document.querySelectorAll(".view").forEach(function (v) {
      v.hidden = v.getAttribute("data-view") !== r.view;
    });
    document.querySelectorAll("[data-tab]").forEach(function (a) {
      if (a.getAttribute("data-tab") === r.view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    var book = books[r.view];
    if (book && r.page !== null) book.goTo(r.page);

    if (changed) window.scrollTo(0, 0);
  }

  /* ---------------- Init ---------------- */

  document.querySelectorAll(".view").forEach(function (view) {
    var el = view.querySelector("[data-book]");
    if (!el) return;
    var name = view.getAttribute("data-view");
    var book = new Book(el);
    book.onChange = function (i) {
      // Keep the URL shareable without adding a history entry per page turn
      history.replaceState(null, "", "#/" + name + (i > 0 ? "/" + (i + 1) : ""));
    };
    books[name] = book;
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var book = books[current];
    if (!book) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { book.next(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { book.prev(); e.preventDefault(); }
    else if (e.key === "Home") { book.goTo(0); e.preventDefault(); }
    else if (e.key === "End") { book.goTo(book.pages.length - 1); e.preventDefault(); }
  });

  // Portrait fallback: show a monogram until a photo is added at assets/abhilash.jpg
  document.querySelectorAll("[data-portrait]").forEach(function (img) {
    function fallback() {
      var m = document.createElement("div");
      m.className = "monogram";
      m.setAttribute("role", "img");
      m.setAttribute("aria-label", "Abhilash CR");
      m.textContent = "ACR";
      img.replaceWith(m);
    }
    if (img.complete && img.naturalWidth === 0) fallback();
    else img.addEventListener("error", fallback);
  });

  window.addEventListener("hashchange", route);
  route();

  // Count this page load (Vercel function); quietly does nothing when the API isn't available
  var counter = document.querySelector("[data-visits]");
  if (window.fetch && location.protocol !== "file:") {
    fetch("/api/visit", { method: "POST", keepalive: true })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !counter || !d.total) return;
        counter.textContent = d.total.toLocaleString() + (d.total === 1 ? " visit" : " visits");
        counter.hidden = false;
      })
      .catch(function () {});
  }
})();

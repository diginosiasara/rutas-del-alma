/* Continuidad de lectura: guarda el último punto leído y los capítulos completados (solo en este dispositivo). */
(function () {
  "use strict";
  var KEY = "rutas-lectura";
  var page = (location.pathname.split("/").pop() || "index.html");
  var isChapter = /^(prologo|capitulo-\d\d-[\w-]+)\.html$/.test(page);
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } }
  function pct() { var d = document.documentElement, max = d.scrollHeight - window.innerHeight; return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1; }

  function ready(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }
  ready(function () {
    var s = read(); s.pages = s.pages || {};
    // marcar capítulos leídos en el menú
    document.querySelectorAll(".menu__top[href]").forEach(function (a) {
      var h = a.getAttribute("href").split("#")[0];
      if ((s.pages[h] || 0) >= 0.9) {
        a.classList.add("is-leido");
        var t = a.querySelector(".menu__title"); if (t) { var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = " (leído)"; t.appendChild(sr); }
      }
    });
    if (isChapter) {
      var h1 = document.querySelector("h1"), title = h1 ? h1.textContent.replace(/\s+/g, " ").trim() : page;
      if (/[?&]continuar=1/.test(location.search) && !location.hash && s.last && s.last.page === page) {
        var max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(max * s.last.pct));
      }
      var tick = null;
      window.addEventListener("scroll", function () {
        if (tick) return;
        tick = setTimeout(function () {
          tick = null; var p = pct(), o = read(); o.pages = o.pages || {};
          o.last = { page: page, title: title, pct: Math.round(p * 100) / 100, ts: Date.now() };
          o.pages[page] = Math.max(o.pages[page] || 0, p); write(o);
        }, 600);
      }, { passive: true });
    }
    // portada: botón «Continuar leyendo»
    if (page === "index.html" && s.last && s.last.page && s.last.pct > 0.02) {
      var box = document.querySelector(".hero__actions");
      if (box) {
        var a = document.createElement("a"); a.className = "btn btn--ghost"; a.href = s.last.page + "?continuar=1";
        a.textContent = "Continuar leyendo (" + Math.round(s.last.pct * 100) + " %)";
        a.setAttribute("aria-label", "Continuar leyendo: " + s.last.title + ", por el " + Math.round(s.last.pct * 100) + " por ciento");
        box.insertBefore(a, box.firstChild);
      }
    }
  });
})();

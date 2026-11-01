/* Ruta del Alma — comportamiento (mejora progresiva: la página funciona sin JS) */
(function () {
  "use strict";

  /* 1 · Menú lateral de capítulos y anclas -------------------------------- */
  function initMenu() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    var overlay = document.querySelector(".nav-overlay");
    var close = nav && nav.querySelector(".nav__close");
    if (!toggle || !nav) return;

    function focusables() {
      return Array.prototype.slice.call(nav.querySelectorAll("a[href], button, summary")).filter(function (el) { return el.offsetParent !== null; });
    }
    function setOpen(open, returnFocus) {
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
      if (overlay) overlay.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { (close || nav.querySelector("a")).focus(); }
      else if (returnFocus) toggle.focus();
    }

    toggle.hidden = false;
    if (close) { close.hidden = false; close.addEventListener("click", function () { setOpen(false, true); }); }
    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    if (overlay) overlay.addEventListener("click", function () { setOpen(false, true); });
    document.addEventListener("keydown", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (e.key === "Escape") { setOpen(false, true); return; }
      if (e.key !== "Tab") return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* 1b · Abrir el índice desplegable al pulsar enlaces a #indice ---------- */
  function initIndexPanel() {
    var panel = document.querySelector("details#indice");
    if (!panel) return;
    function open() { panel.open = true; }
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href="#indice"]');
      if (a) open();
    });
    if (location.hash === "#indice") open();
    window.addEventListener("hashchange", function () { if (location.hash === "#indice") open(); });
  }

  /* 2 · Sección activa (aria-current) ------------------------------------- */
  function initScrollSpy() {
    if (!("IntersectionObserver" in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('#site-nav a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var link = map[entry.target.id];
        if (link) link.setAttribute("aria-current", "location");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });

    Object.keys(map).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  /* 3 · Lector de voz compacto (Web Speech API) --------------------------- */
  function initReader() {
    var synth = window.speechSynthesis;
    var root = document.getElementById("reader");
    if (!synth || !root || !window.SpeechSynthesisUtterance) return;

    var panel = document.getElementById("reader-panel");
    var fab = root.querySelector(".reader__fab");
    var $ = function (a) { return root.querySelector('[data-action="' + a + '"]'); };
    var btn = { play: $("play"), prev: $("prev"), next: $("next"), stop: $("stop"), close: $("close"), sel: $("selection"), pick: $("pick") };
    var playLabel = root.querySelector("[data-play-label]");
    var rate = root.querySelector("select");
    var status = root.querySelector("[data-status]");
    var hint = root.querySelector("[data-hint]");
    var main = document.getElementById("contenido");
    var blocks = [], pos = { b: 0, c: 0 }, token = 0, marked = null, lastSelection = "", state = "idle";

    root.hidden = false;
    document.body.classList.add("has-reader");

    function openPanel(open, returnFocus) {
      panel.hidden = !open;
      fab.hidden = open;
      fab.setAttribute("aria-expanded", String(open));
      if (open) btn.play.focus(); else if (returnFocus) fab.focus();
    }

    function setState(s) {
      state = s;
      var active = s !== "idle";
      btn.prev.disabled = btn.next.disabled = btn.stop.disabled = !active;
      btn.play.classList.toggle("is-playing", s === "playing");
      root.classList.toggle("is-speaking", s === "playing");
      var label = s === "playing" ? "Pausar" : s === "paused" ? "Reanudar" : "Escuchar página";
      playLabel.textContent = label; btn.play.title = label;
    }

    function chunk(text) {
      var parts = text.match(/[^.!?]+[.!?]*\s*/g) || [text], out = [], cur = "";
      parts.forEach(function (p) {
        if (cur && (cur + p).length > 200) { out.push(cur); cur = ""; }
        while (p.length > 200) {
          var cut = p.lastIndexOf(" ", 200);
          if (cut < 1) cut = 200;
          out.push(p.slice(0, cut)); p = p.slice(cut);
        }
        cur += p;
      });
      if (cur.trim()) out.push(cur);
      return out;
    }

    function collect(scope) {
      var list = [];
      scope.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd,figcaption,img").forEach(function (el) {
        if (el.closest(".reader") || el.closest('[aria-hidden="true"]') || el.closest("nav")) return;
        var text, target = el;
        if (el.tagName === "IMG") {
          if (!el.alt) return;
          text = "Imagen: " + el.alt; target = el.closest(".frame") || el;
        } else {
          if (el.querySelector("p,li,h3,dt,dd")) return;
          var copy = el.cloneNode(true);
          copy.querySelectorAll('[aria-hidden="true"]').forEach(function (n) { n.remove(); });
          text = copy.textContent.replace(/\s+/g, " ").trim();
        }
        if (text) list.push({ el: target, chunks: chunk(text) });
      });
      return list;
    }

    function mark(el) {
      if (marked === el) return;
      if (marked) marked.classList.remove("is-reading");
      marked = el;
      if (el) { el.classList.add("is-reading"); el.scrollIntoView({ block: "nearest" }); }
    }

    function setPick(on) {
      document.body.classList.toggle("pick-mode", on);
      btn.pick.setAttribute("aria-pressed", String(on));
      hint.hidden = !on;
      if (on) status.textContent = "Modo elegir texto: toca el texto donde quieres empezar a leer.";
    }

    function stop(message) {
      token++;
      synth.cancel();
      mark(null);
      setState("idle");
      if (message) status.textContent = message;
    }

    function play(b, c, t) {
      if (t !== token) return;
      if (b < 0) b = 0;
      if (b >= blocks.length) { stop("Lectura terminada."); return; }
      if (c >= blocks[b].chunks.length) { play(b + 1, 0, t); return; }
      pos = { b: b, c: c };
      var u = new SpeechSynthesisUtterance(blocks[b].chunks[c]);
      var voice = synth.getVoices().filter(function (v) { return v.lang.toLowerCase().indexOf("es") === 0; })[0];
      u.lang = "es-ES";
      if (voice) u.voice = voice;
      u.rate = parseFloat(rate.value) || 1;
      u.onend = function () { play(b, c + 1, t); };
      u.onerror = function () { if (t === token) stop("No se pudo continuar la lectura."); };
      mark(blocks[b].el);
      synth.speak(u);
    }

    function startAt(list, b, label) {
      token++;
      synth.cancel(); synth.resume();
      blocks = list;
      if (!blocks.length) return;
      setState("playing");
      status.textContent = label;
      play(b, 0, token);
    }

    function jump(b) {
      token++;
      synth.cancel(); synth.resume();
      setState("playing");
      play(b, 0, token);
    }

    function blockIndexFor(list, target) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].el === target || list[i].el.contains(target)) return i;
      }
      for (var k = 0; k < list.length; k++) {
        if (target.compareDocumentPosition(list[k].el) & Node.DOCUMENT_POSITION_FOLLOWING) return k;
      }
      return -1;
    }

    fab.addEventListener("click", function () { openPanel(true); });
    btn.close.addEventListener("click", function () { setPick(false); openPanel(false, true); });
    btn.play.addEventListener("click", function () {
      if (state === "idle") { setPick(false); startAt(collect(main), 0, "Leyendo la página completa."); }
      else if (state === "playing") { synth.pause(); setState("paused"); status.textContent = "Lectura en pausa."; }
      else { synth.resume(); setState("playing"); status.textContent = "Lectura reanudada."; }
    });
    btn.next.addEventListener("click", function () { jump(pos.b + 1); });
    btn.prev.addEventListener("click", function () { jump(pos.c > 0 ? pos.b : pos.b - 1); });
    btn.stop.addEventListener("click", function () { stop("Lectura detenida."); });

    document.addEventListener("selectionchange", function () {
      var t = String(window.getSelection() || "").trim();
      if (t) lastSelection = t;
    });
    btn.sel.addEventListener("click", function () {
      var t = String(window.getSelection() || "").trim() || lastSelection;
      if (!t) { status.textContent = "Selecciona primero un texto y vuelve a pulsar."; return; }
      setPick(false);
      startAt([{ el: null, chunks: chunk(t) }], 0, "Leyendo el texto seleccionado.");
    });

    btn.pick.addEventListener("click", function () { setPick(!document.body.classList.contains("pick-mode")); });
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("pick-mode")) return;
      if (!main.contains(e.target) || e.target.closest("a,button:not(.zoom)")) return;
      e.preventDefault(); e.stopPropagation();
      var list = collect(main), i = blockIndexFor(list, e.target);
      setPick(false);
      if (i >= 0) startAt(list, i, "Leyendo desde el texto elegido.");
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || panel.hidden) return;
      if (document.body.classList.contains("pick-mode")) setPick(false);
      else if (state !== "idle") stop("Lectura detenida.");
      else openPanel(false, true);
    });
    window.addEventListener("pagehide", function () { synth.cancel(); });
  }

  /* 4 · Ampliar imágenes (lightbox con <dialog>) -------------------------- */
  function initZoom() {
    if (typeof HTMLDialogElement === "undefined") return;
    var dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Imagen ampliada");
    dlg.innerHTML = '<button type="button" class="lightbox__close" aria-label="Cerrar imagen ampliada">&times;</button><img class="lightbox__img" alt="">';
    document.body.appendChild(dlg);
    var big = dlg.querySelector("img");

    function largest(img) {
      var set = (img.getAttribute("srcset") || "").split(",").map(function (s) { return s.trim().split(/\s+/)[0]; });
      return set[set.length - 1] || img.currentSrc || img.src;
    }
    function close() { dlg.close(); }

    document.querySelectorAll("main .frame img").forEach(function (img) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zoom";
      btn.setAttribute("aria-label", "Ampliar imagen: " + img.alt);
      img.parentNode.insertBefore(btn, img);
      btn.appendChild(img);
      btn.addEventListener("click", function () {
        big.src = largest(img);
        big.alt = img.alt;
        dlg.showModal();
      });
    });
    dlg.addEventListener("click", function (e) { if (e.target !== big) close(); });
    big.addEventListener("click", close);
    dlg.querySelector(".lightbox__close").addEventListener("click", close);
    dlg.addEventListener("close", function () { big.removeAttribute("src"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenu();
    initIndexPanel();
    initScrollSpy();
    initReader();
    initZoom();
  });
})();

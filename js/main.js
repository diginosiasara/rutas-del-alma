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
        var closed = el.closest("details:not([open])");
        if (closed && !el.closest("summary")) return;
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

  /* 5 · Carrusel de vídeos: carril continuo de derecha a izquierda, pausable */
  function initCarousel() {
    var root = document.querySelector(".carousel");
    if (!root) return;
    var track = root.querySelector(".carousel__track");
    var items = Array.prototype.slice.call(track.children);
    var bar = root.querySelector(".carousel__bar");
    var toggle = root.querySelector('[data-carousel="toggle"]');
    var label = toggle.querySelector("span");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var SPEED = 40; /* px por segundo */
    var playing = !reduce, hover = false, touched = false, touchTimer = null;
    var pos = 0, setLeft = 0, last = 0;
    bar.hidden = false;

    /* Copias decorativas del principio para que el bucle no tenga saltos */
    var clones = items.slice(0, Math.min(3, items.length)).map(function (it) {
      var c = it.cloneNode(true);
      c.setAttribute("aria-hidden", "true"); c.setAttribute("inert", "");
      c.removeAttribute("role"); c.removeAttribute("aria-roledescription"); c.removeAttribute("aria-label");
      track.appendChild(c); return c;
    });
    function loop() { return clones[0].offsetLeft - items[0].offsetLeft; }
    function stepSize() { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth; }
    function busy() {
      return hover || touched || root.contains(document.activeElement) || !!root.querySelector("details[open]") || document.hidden;
    }
    function render() {
      label.textContent = playing ? "Pausar movimiento" : "Reanudar movimiento";
      track.setAttribute("aria-live", playing ? "off" : "polite");
      track.classList.toggle("is-moving", playing);
    }
    function frame(t) {
      var dt = last ? Math.min((t - last) / 1000, 0.1) : 0; last = t;
      var now = track.scrollLeft;
      if (Math.abs(now - setLeft) > 2) { pos = now; setLeft = now; }       /* la persona se ha desplazado */
      var w = loop();
      if (w > 0 && now >= w + 1 && Math.abs(now - setLeft) <= 2) { pos = now - w; track.scrollLeft = pos; setLeft = track.scrollLeft; }
      else if (playing && !busy() && w > 0) {
        pos += SPEED * dt;
        if (pos >= w) pos -= w;
        var r = Math.round(pos);
        if (r !== Math.round(now)) track.scrollLeft = r;
        setLeft = track.scrollLeft;
      }
      requestAnimationFrame(frame);
    }
    function step(dir) {
      var w = loop();
      if (dir < 0 && track.scrollLeft < stepSize() && w > 0) { track.scrollLeft += w; setLeft = track.scrollLeft; pos = setLeft; }
      track.scrollBy({ left: dir * stepSize(), behavior: reduce ? "auto" : "smooth" });
    }

    root.addEventListener("pointerenter", function () { hover = true; });
    root.addEventListener("pointerleave", function () { hover = false; });
    root.addEventListener("touchstart", function () {
      touched = true; clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { touched = false; }, 9000);
    }, { passive: true });
    toggle.addEventListener("click", function () { playing = !playing; render(); });
    root.querySelector('[data-carousel="prev"]').addEventListener("click", function () { step(-1); });
    root.querySelector('[data-carousel="next"]').addEventListener("click", function () { step(1); });
    render();
    requestAnimationFrame(frame);
  }

  /* 5b · Vídeos de YouTube bajo demanda: no se descarga el reproductor hasta pulsar */
  function initVideoFacades() {
    document.addEventListener("click", function (e) {
      var f = e.target.closest(".yt-facade");
      if (!f) return;
      var ifr = document.createElement("iframe");
      ifr.src = "https://www.youtube-nocookie.com/embed/" + f.getAttribute("data-yt") + "?rel=0&autoplay=1";
      ifr.title = f.getAttribute("data-title") + " — reproductor de YouTube";
      ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      ifr.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      ifr.setAttribute("allowfullscreen", "");
      f.replaceWith(ifr);
      ifr.focus();
    });
  }

  /* 6 · Animaciones de scroll: aparición escalonada, progreso, cabecera y parallax suave */
  function initMotion() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

    /* Barra de progreso de lectura y sombra de cabecera (no son movimiento ornamental) */
    var bar = document.createElement("div");
    bar.className = "scroll-progress"; bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var header = document.querySelector(".site-header");
    var parallax = [], ticking = false;

    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty("--p", max > 0 ? Math.min(window.scrollY / max, 1).toFixed(4) : 0);
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
      if (reduce) return;
      var vh = window.innerHeight;
      parallax.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)));
        el.style.translate = "0 " + (-p * 14).toFixed(1) + "px";
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    if (!("IntersectionObserver" in window) || reduce) {
      all("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
      all(".deco").forEach(function (el) { el.classList.add("is-live"); });
      return;
    }

    /* Elementos por debajo del pliegue que no traían data-reveal: se revelan también */
    var AUTO = ".section__head, .figure, .band, .card, .guardian, .about__text, .about__media, .toc li, .tags li, .ratings > div, .areas > div, .chapter-toc__list > li, .mini-card, .facts > div, .video, .promo__card, .stats > div, .exercise, .site-footer__inner";
    all(AUTO).forEach(function (el) {
      if (!el.hasAttribute("data-reveal") && el.getBoundingClientRect().top > window.innerHeight * 0.95) el.setAttribute("data-reveal", "");
    });
    /* Escalonado entre hermanos */
    all(".tags, .ratings, .areas, .toc, .chapter-toc__list, .mini-grid, .facts, .stats, .guardians__grid, .videos__grid").forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty("--d", (i * 0.09).toFixed(2) + "s"); });
    });

    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); reveal.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    all("[data-reveal]").forEach(function (el) { reveal.observe(el); });

    var live = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("is-live", e.isIntersecting); });
    });
    all(".deco").forEach(function (el) { live.observe(el); });

    /* Parallax: solo se calcula para las láminas visibles */
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = parallax.indexOf(e.target);
        if (e.isIntersecting && i < 0) parallax.push(e.target);
        else if (!e.isIntersecting && i >= 0) { parallax.splice(i, 1); e.target.style.translate = ""; }
      });
      onScroll();
    }, { rootMargin: "20% 0px" });
    all(".band__media .frame, .figure .frame, .about__media .frame, .guardian .frame").forEach(function (el) { seen.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenu();
    initIndexPanel();
    initScrollSpy();
    initReader();
    initZoom();
    initCarousel();
    initVideoFacades();
    initMotion();
  });
})();

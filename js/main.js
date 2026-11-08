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
    var retries = 0, lastStart = 0, watchdog = null;

    root.hidden = false;
    document.body.classList.add("has-reader");

    /* Mantiene la pantalla encendida solo mientras se está leyendo en voz alta.
       Se libera al pausar, detener o terminar, y se vuelve a pedir si la pestaña
       recupera el foco (el navegador la libera al ocultar la página). */
    var wake = null, wantWake = false;
    function requestWake() {
      wantWake = true;
      if (!("wakeLock" in navigator) || wake || document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(function (lock) {
        if (!wantWake) { lock.release().catch(function () {}); return; }
        wake = lock;
        lock.addEventListener("release", function () { if (wake === lock) wake = null; });
      }).catch(function () { /* sin permiso o sin HTTPS: la lectura sigue igual */ });
    }
    function releaseWake() {
      wantWake = false;
      if (wake) { var lock = wake; wake = null; lock.release().catch(function () {}); }
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && wantWake) requestWake();
    });

    /* ---- Preferencias del lector (se guardan solo en este dispositivo) ---- */
    var PREFS_KEY = "ruta-del-alma:lector";
    var prefs = { rate: "", voice: "", keep: true, images: true };
    try { var raw = window.localStorage.getItem(PREFS_KEY); if (raw) Object.assign(prefs, JSON.parse(raw)); } catch (e) {}
    function savePrefs() { try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }
    if (prefs.rate && rate.querySelector('option[value="' + prefs.rate + '"]')) rate.value = prefs.rate;
    rate.addEventListener("change", function () { prefs.rate = rate.value; savePrefs(); });

    /* ---- Controles extra (se crean aquí para no repetir el HTML en cada página) ---- */
    var opts = root.querySelector(".reader__opts");
    function field(html, cls) { var d = document.createElement("div"); d.className = "reader__field" + (cls ? " " + cls : ""); d.innerHTML = html; opts.appendChild(d); return d; }
    var secRow = field('<button type="button" class="reader__btn" data-action="section">Leer este apartado</button>'
      + '<button type="button" class="reader__btn" data-action="head-prev" disabled>Apartado anterior</button>'
      + '<button type="button" class="reader__btn" data-action="head-next" disabled>Apartado siguiente</button>', "reader__field--stack");
    var voiceRow = field('<label class="reader__label" for="reader-voice">Voz</label><select id="reader-voice" class="reader__select"></select>');
    var keepRow = field('<label class="reader__check"><input type="checkbox" data-pref="keep"><span>Mantener activo en el móvil: pantalla encendida y sesión de audio para que no se corte al bloquear</span></label>');
    var imgRow = field('<label class="reader__check"><input type="checkbox" data-pref="images"><span>Leer también las descripciones de las imágenes</span></label>');
    var secBtn = secRow.querySelector('[data-action="section"]'), headPrev = secRow.querySelector('[data-action="head-prev"]'), headNext = secRow.querySelector('[data-action="head-next"]');
    var voiceSel = voiceRow.querySelector("select");
    var chkKeep = keepRow.querySelector("input"), chkImg = imgRow.querySelector("input");
    chkKeep.checked = !!prefs.keep; chkImg.checked = !!prefs.images;
    chkKeep.addEventListener("change", function () { prefs.keep = chkKeep.checked; savePrefs(); if (state === "playing") { prefs.keep ? (requestWake(), startKeepAlive()) : (releaseWake(), stopKeepAlive()); } });
    chkImg.addEventListener("change", function () { prefs.images = chkImg.checked; savePrefs(); });
    var prog = document.createElement("progress");
    prog.className = "reader__progress"; prog.hidden = true; prog.value = 0; prog.max = 1;
    prog.setAttribute("aria-label", "Progreso de la lectura");
    panel.insertBefore(prog, panel.querySelector(".reader__row"));
    fab.setAttribute("aria-keyshortcuts", "Alt+Shift+L");

    /* ---- Voces en español ---- */
    var voices = [];
    function loadVoices() {
      voices = synth.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("es") === 0; })
        .sort(function (a, b) { return (b.lang.toLowerCase() === "es-es") - (a.lang.toLowerCase() === "es-es"); });
      voiceSel.innerHTML = '<option value="">Automática</option>';
      voices.forEach(function (v) { var o = document.createElement("option"); o.value = v.voiceURI; o.textContent = v.name + " (" + v.lang + ")"; voiceSel.appendChild(o); });
      voiceSel.value = prefs.voice; if (voiceSel.value !== prefs.voice) voiceSel.value = "";
      voiceRow.hidden = voices.length < 2;
    }
    voiceSel.addEventListener("change", function () { prefs.voice = voiceSel.value; savePrefs(); if (state === "playing") restartCurrent(); });
    loadVoices();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", loadVoices); else synth.onvoiceschanged = loadVoices;

    /* ---- Mantener viva la sesión en el móvil -----------------------------------
       1) Pantalla encendida (Wake Lock; si no existe, vídeo mudo diminuto).
       2) Audio mudo en bucle + Media Session: el sistema trata la página como
          reproducción multimedia (controles en la pantalla de bloqueo, menos
          probabilidad de que la suspenda al ir a segundo plano).
       Ningún navegador garantiza seguir hablando con la pantalla bloqueada; si el
       sistema interrumpe la voz, el vigilante la reanuda al volver. */
    var keepAudio = null, keepVideo = null;
    function silentWavUrl() {
      var rate8 = 8000, n = rate8, buf = new ArrayBuffer(44 + n), v = new DataView(buf), i;
      function str(o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
      str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, rate8, true); v.setUint32(28, rate8, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      str(36, "data"); v.setUint32(40, n, true);
      for (i = 0; i < n; i++) v.setUint8(44 + i, 128);
      return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    }
    function startVideoFallback() {
      if (keepVideo) { keepVideo.play().catch(function () {}); return; }
      keepVideo = document.createElement("video");
      keepVideo.setAttribute("playsinline", ""); keepVideo.setAttribute("aria-hidden", "true"); keepVideo.setAttribute("tabindex", "-1");
      keepVideo.muted = true; keepVideo.loop = true;
      keepVideo.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:.01;pointer-events:none";
      keepVideo.innerHTML = '<source src="data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAJAEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEeTbuMU6uEHFO7a1OsggIq7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECPQAAAAAAAFlSua8GuAQAAAAAAADjXgQFzxYhyJESsCZXEhJyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAvrwgDgibCBILqBIJqBAhJUw2f8c3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9ZjwItjxYhyJESsCZXEhGfIoUWjh0VOQ09ERVJEh5RMYXZjNjAuMzEuMTAyIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVAheeBAKOkgQAAgDACAJ0BKiAAIAAARwiFhYiFhIgCAgAHkPPJwP7/q1CAo5WBAMgAsQEAARAQABgAGFgv9AAIcACjlYEBkACxAQABEBAAGAAYWC/0AAhwAKOVgQJYALEBAAEQEAAYABhYL/QACHAAo5WBAyAAsQEAARAQABgAGFgv9AAIcAAcU7trkbuPs4EAt4r3gQHxggGf8IED" type="video/webm"><source src="data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAM3bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAmF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAHZbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABhG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAURzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZCWwEQAAAAwBAAAADAoPEiZIBAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABVgAAAVYAAAABhzdHRzAAAAAAAAAAEAAAAFAAAIAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAFAAAAAQAAAChzdHN6AAAAAAAAAAAAAAAFAAAChQAAAAoAAAAKAAAACgAAAAkAAAAUc3RjbwAAAAAAAAABAAADZwAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAK0bWRhdAAAAnAGBf//bNxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAANZYiEBHyYoAA2IyddeAAAAAZBmjgI+WAAAAAGQZpUAj5YAAAABkGaYBDywAAAAAVBmoA/yw==" type="video/mp4">';
      document.body.appendChild(keepVideo);
      var pv = keepVideo.play(); if (pv && pv.catch) pv.catch(function () {});
    }
    function startKeepAlive() {
      if (!prefs.keep) return;
      requestWake();
      try {
        if (!keepAudio) { keepAudio = new Audio(silentWavUrl()); keepAudio.loop = true; keepAudio.setAttribute("aria-hidden", "true"); }
        var pa = keepAudio.play(); if (pa && pa.catch) pa.catch(function () {});
      } catch (e) {}
      if (!("wakeLock" in navigator)) startVideoFallback();
    }
    function stopKeepAlive() {
      try { if (keepAudio) keepAudio.pause(); } catch (e) {}
      try { if (keepVideo) keepVideo.pause(); } catch (e) {}
    }
    function sessionState(s) { if ("mediaSession" in navigator) { try { navigator.mediaSession.playbackState = s; } catch (e) {} } }
    (function initSession() {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      var h1 = document.querySelector("h1");
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: document.title.split("|")[0].trim() || (h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "Ruta del Alma"), artist: "Ruta del Alma", album: "Lector de voz" }); } catch (e) {}
      function set(a, f) { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} }
      set("play", function () { if (state !== "playing") btn.play.click(); });
      set("pause", function () { if (state === "playing") btn.play.click(); });
      set("stop", function () { if (state !== "idle") btn.stop.click(); });
      set("previoustrack", function () { if (!btn.prev.disabled) btn.prev.click(); });
      set("nexttrack", function () { if (!btn.next.disabled) btn.next.click(); });
    })();

    /* ---- Vigilante: si el sistema corta o pausa la voz, se reanuda ---- */
    function restartCurrent() {
      var t = ++token;
      synth.cancel(); synth.resume();
      play(pos.b, pos.c, t);
    }
    function ensureSpeaking() {
      if (state !== "playing") return;
      if (synth.paused) synth.resume();
      if (!synth.speaking && !synth.pending && Date.now() - lastStart > 1500) restartCurrent();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") window.setTimeout(ensureSpeaking, 300);
    });
    window.addEventListener("pageshow", function () { window.setTimeout(ensureSpeaking, 300); });
    window.addEventListener("focus", function () { window.setTimeout(ensureSpeaking, 300); });

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
      headPrev.disabled = headNext.disabled = !active;
      prog.hidden = !active;
      if (s === "playing") {
        startKeepAlive(); sessionState("playing");
        if (!watchdog) watchdog = window.setInterval(ensureSpeaking, 2500);
      } else {
        releaseWake(); stopKeepAlive(); sessionState(s === "paused" ? "paused" : "none");
        if (watchdog) { window.clearInterval(watchdog); watchdog = null; }
      }
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
          if (!el.alt || !prefs.images) return;
          text = "Imagen: " + el.alt; target = el.closest(".frame") || el;
        } else {
          if (el.querySelector("p,li,h3,dt,dd")) return;
          var copy = el.cloneNode(true);
          copy.querySelectorAll('[aria-hidden="true"]').forEach(function (n) { n.remove(); });
          text = copy.textContent.replace(/\s+/g, " ").trim();
        }
        if (text) list.push({ el: target, chunks: chunk(text), head: /^H[23]$/.test(el.tagName) });
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
      var voice = voices.filter(function (v) { return v.voiceURI === prefs.voice; })[0] || voices[0];
      u.lang = "es-ES";
      if (voice) u.voice = voice;
      u.rate = parseFloat(rate.value) || 1;
      u.onend = function () { retries = 0; play(b, c + 1, t); };
      u.onerror = function (e) {
        if (t !== token) return;
        var err = e && e.error;
        if (err === "canceled" || err === "interrupted") return;   /* el vigilante reanuda si hace falta */
        if (retries < 2) { retries++; window.setTimeout(function () { play(b, c, t); }, 400); }
        else stop("No se pudo continuar la lectura.");
      };
      mark(blocks[b].el);
      prog.max = blocks.length; prog.value = b + 1;
      lastStart = Date.now();
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
      if (state === "idle") { setPick(false); startAt(collect(main), 0, "Leyendo la página completa." + ("wakeLock" in navigator ? " La pantalla seguirá encendida mientras dure la lectura." : "")); }
      else if (state === "playing") { synth.pause(); setState("paused"); status.textContent = "Lectura en pausa."; }
      else { synth.resume(); setState("playing"); status.textContent = "Lectura reanudada."; }
    });
    btn.next.addEventListener("click", function () { jump(pos.b + 1); });
    btn.prev.addEventListener("click", function () { jump(pos.c > 0 ? pos.b : pos.b - 1); });
    btn.stop.addEventListener("click", function () { stop("Lectura detenida."); });

    function currentScope() {
      var el = document.activeElement, s;
      if (el && el !== main && main.contains(el)) { s = el.closest("main > section"); if (s) return s; }
      /* elementsFromPoint: el propio panel del lector puede tapar ese punto en pantallas pequeñas */
      var stack = document.elementsFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight * 0.35));
      for (var k = 0; k < stack.length; k++) {
        s = main.contains(stack[k]) ? stack[k].closest("main > section") : null;
        if (s) return s;
      }
      return main;
    }
    secBtn.addEventListener("click", function () {
      setPick(false);
      var scope = currentScope(), list = collect(scope);
      if (!list.length) { status.textContent = "No hay texto que leer en este apartado."; return; }
      startAt(list, 0, "Leyendo este apartado.");
    });
    function jumpHead(dir) {
      var i, from = pos.b;
      if (dir > 0) {
        for (i = from + 1; i < blocks.length; i++) if (blocks[i].head) { jump(i); return; }
        stop("No hay más apartados."); return;
      }
      if (!blocks[from].head) { i = from; while (i > 0 && !blocks[i].head) i--; jump(i); return; }
      for (i = from - 1; i >= 0; i--) if (blocks[i].head) { jump(i); return; }
      jump(0);
    }
    headNext.addEventListener("click", function () { jumpHead(1); });
    headPrev.addEventListener("click", function () { jumpHead(-1); });

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
      if (e.altKey && e.shiftKey && (e.key === "L" || e.key === "l")) {   /* Alt+Mayús+L: abrir y reproducir / pausar */
        e.preventDefault();
        if (panel.hidden) openPanel(true);
        btn.play.click();
        return;
      }
      if (e.key !== "Escape" || panel.hidden) return;
      if (document.body.classList.contains("pick-mode")) setPick(false);
      else if (state !== "idle") stop("Lectura detenida.");
      else openPanel(false, true);
    });
    window.addEventListener("pagehide", function () { synth.cancel(); releaseWake(); stopKeepAlive(); });
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

    function describe(img) {
      if (img.alt) return img.alt;
      var fig = img.closest("figure"), cap = fig && fig.querySelector("figcaption");
      return cap ? cap.textContent.replace(/\s+/g, " ").trim() : "sin descripción";
    }
    document.querySelectorAll("main .frame img").forEach(function (img) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zoom";
      btn.setAttribute("aria-label", "Ampliar imagen: " + describe(img));
      img.parentNode.insertBefore(btn, img);
      btn.appendChild(img);
      btn.addEventListener("click", function () {
        big.src = largest(img);
        big.alt = describe(img);
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


  /* 7 · Animaciones de scroll extra: lado de cada tarjeta, tarjetas sueltas escalonadas y «Volver arriba» */
  function initScrollFx() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

    /* «Volver arriba»: aparece tras bajar más de una pantalla y mueve el foco al título */
    var top = document.createElement("button");
    top.type = "button"; top.className = "to-top"; top.hidden = true;
    top.setAttribute("aria-label", "Volver al inicio de la página");
    top.innerHTML = '<span aria-hidden="true">↑</span>';
    document.body.appendChild(top);
    var shown = false, tick = false;
    function check() {
      tick = false;
      var on = window.scrollY > window.innerHeight * 1.2;
      if (on === shown) return;
      shown = on;
      if (on) { top.hidden = false; window.requestAnimationFrame(function () { top.classList.add("is-on"); }); }
      else { top.classList.remove("is-on"); window.setTimeout(function () { if (!shown) top.hidden = true; }, 380); }
    }
    window.addEventListener("scroll", function () { if (!tick) { tick = true; window.requestAnimationFrame(check); } }, { passive: true });
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      var h1 = document.querySelector("h1");
      if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
    });
    check();

    if (reduce) return;

    /* Capa decorativa fija de cada capítulo (hilo, tallo, agua, rayos…): su aspecto lo define el CSS del
       capítulo y lo único que hace aquí el script es publicar el progreso de lectura en --p (0 a 1). */
    if (/(^|\s)theme-/.test(document.body.className)) {
      var fx = document.createElement("div");
      fx.className = "chapter-fx"; fx.setAttribute("aria-hidden", "true");
      fx.innerHTML = '<span class="fx-a"></span><span class="fx-b"></span>';
      document.body.appendChild(fx);
      var fxTick = false;
      var fxUpdate = function () {
        fxTick = false;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        fx.style.setProperty("--p", max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1).toFixed(4) : "0");
      };
      window.addEventListener("scroll", function () { if (!fxTick) { fxTick = true; window.requestAnimationFrame(fxUpdate); } }, { passive: true });
      window.addEventListener("resize", fxUpdate);
      fxUpdate();
    }

    /* Lado de la imagen en cada tarjeta (cambia según el tema y el ancho de pantalla) */
    function sides() {
      all(".band").forEach(function (b) {
        var m = b.querySelector(".band__media"), t = b.querySelector(".band__text"), side;
        if (!m || !t) side = "solo";
        else if (Math.abs(m.offsetTop - t.offsetTop) > 40 && Math.abs(m.offsetLeft - t.offsetLeft) < 40) side = "stack";
        else side = m.offsetLeft < t.offsetLeft ? "media-left" : "media-right";
        if (b.getAttribute("data-side") !== side) b.setAttribute("data-side", side);
      });
    }
    sides();
    var rt = null;
    window.addEventListener("resize", function () { window.clearTimeout(rt); rt = window.setTimeout(sides, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sides);
    window.addEventListener("load", sides);

    /* Tarjetas sueltas que no traían data-reveal: se revelan escalonadas al llegar a ellas */
    var EXTRA = ".theory > li, .theory-cards > li, .wb, .exercise, .callout--center";
    all(EXTRA).forEach(function (el, i) {
      if (!el.hasAttribute("data-reveal") && el.getBoundingClientRect().top > window.innerHeight * 0.95) {
        el.setAttribute("data-reveal", "");
        var sib = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.setProperty("--d", (Math.min(sib, 6) * 0.08).toFixed(2) + "s");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenu();
    initIndexPanel();
    initScrollSpy();
    initReader();
    initZoom();
    initCarousel();
    initVideoFacades();
    initScrollFx();
    initMotion();
  });
})();

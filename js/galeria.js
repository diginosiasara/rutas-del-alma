/* Filtro por estilo en «Personajes en tres estilos» (sin JS se ven todos) */
(function () {
  var bar = document.querySelector("[data-style-filter]");
  if (!bar) return;
  bar.hidden = false;
  var btns = bar.querySelectorAll("button");
  var figs = document.querySelectorAll(".trio__fig");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var s = b.getAttribute("data-style");
      btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      figs.forEach(function (f) { f.hidden = !!s && f.getAttribute("data-style") !== s; });
    });
  });
})();

import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Mi propio sitio que voy a proxiar. OJO: debe ser un dominio DISTINTO al que
// sirve este proxy, si no se llamaria a si mismo en bucle.
const TARGET = process.env.TARGET || "https://clase.alexandramarin.co";

// Latencia artificial (ms) para la CARGA de la pagina (lado servidor).
const SERVER_DELAY_MS = Number(process.env.SERVER_DELAY_MS || 0);

// Duracion del overlay "Cargando..." al ENVIAR el formulario (ms).
const FORM_DELAY_MS = Number(process.env.FORM_DELAY_MS || 30000);

// ---------------------------------------------------------------------------
// Script inyectado: al enviar el formulario muestra "Cargando..." durante
// FORM_DELAY_MS y LUEGO deja continuar el envio real (la reserva se registra).
// ---------------------------------------------------------------------------
const INYECCION = `
<script>
(function () {
  var DELAY = ${FORM_DELAY_MS};
  var yaProcesado = new WeakSet();

  var estilo = document.createElement("style");
  estilo.textContent = "@keyframes __sp{to{transform:rotate(360deg)}}";
  document.head.appendChild(estilo);

  function mostrarCarga() {
    var o = document.createElement("div");
    o.id = "__overlayCarga";
    o.style.cssText =
      "position:fixed;inset:0;background:rgba(255,255,255,.95);" +
      "display:flex;align-items:center;justify-content:center;" +
      "z-index:2147483647;font-family:sans-serif;color:#333";
    o.innerHTML =
      '<div style="text-align:center">' +
      '<div style="width:52px;height:52px;border:5px solid #ddd;' +
      "border-top-color:#555;border-radius:50%;margin:0 auto 18px;" +
      'animation:__sp 1s linear infinite"></div>' +
      '<p style="font-size:16px">Cargando...</p></div>';
    document.body.appendChild(o);
    return o;
  }

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (yaProcesado.has(form)) return; // ya lo dejamos pasar tras la espera
      e.preventDefault();
      e.stopPropagation();
      var overlay = mostrarCarga();
      setTimeout(function () {
        overlay.remove();
        yaProcesado.add(form);
        // Reenvia el formulario DE VERDAD: la reserva se registra normalmente.
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      }, DELAY);
    },
    true
  );
})();
</script>
`;

// Latencia artificial en la carga de la pagina.
app.use((req, res, next) => {
  if (SERVER_DELAY_MS > 0) setTimeout(next, SERVER_DELAY_MS);
  else next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Proxy inverso hacia mi propio sitio, inyectando el script en el HTML.
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyRes: responseInterceptor(
        async (responseBuffer, proxyRes, _req, _res) => {
          const contentType = proxyRes.headers["content-type"] || "";
          if (!contentType.includes("text/html")) return responseBuffer;
          let html = responseBuffer.toString("utf8");
          return html.includes("</body>")
            ? html.replace("</body>", INYECCION + "</body>")
            : html + INYECCION;
        }
      ),
    },
  })
);

app.listen(PORT, () => {
  console.log(
    `Proxy en http://localhost:${PORT} -> ${TARGET} ` +
      `(carga +${SERVER_DELAY_MS}ms, formulario ${FORM_DELAY_MS}ms)`
  );
});

import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Origen del contenido real: la URL .vercel.app del proyecto. Debe ser una
// direccion DISTINTA a la que sirve el proxy, para no crear un bucle.
const TARGET = process.env.TARGET || "https://alexa-marin-sales-page.vercel.app";

// Latencia artificial (ms) en la carga de la pagina (lado servidor).
const SERVER_DELAY_MS = Number(process.env.SERVER_DELAY_MS || 0);

// Duracion del overlay "Cargando..." al enviar el formulario (ms).
const FORM_DELAY_MS = Number(process.env.FORM_DELAY_MS || 30000);

// A donde redirigir despues de la carga lenta (siguiente paso del embudo).
const REDIRECT_TO = process.env.REDIRECT_TO || "/unirse-al-grupo";

// ---------------------------------------------------------------------------
// Script inyectado: al enviar el formulario muestra "Cargando..." durante
// FORM_DELAY_MS y luego redirige a la pagina de gracias.
// ---------------------------------------------------------------------------
const INYECCION = `
<script>
(function () {
  var DELAY = ${FORM_DELAY_MS};
  var DESTINO = ${JSON.stringify(REDIRECT_TO)};

  var estilo = document.createElement("style");
  estilo.textContent = "@keyframes __sp{to{transform:rotate(360deg)}}";
  document.head.appendChild(estilo);

  function mostrarCarga() {
    var o = document.createElement("div");
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
  }

  document.addEventListener(
    "submit",
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      mostrarCarga();
      setTimeout(function () {
        window.location.href = DESTINO;
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

// Solo inyectamos la carga lenta en la pagina de inicio.
const soloEnInicio = (req) => (req.url || "/").split("?")[0] === "/";

// Proxy inverso hacia el contenido real, inyectando el script en el HTML.
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyRes: responseInterceptor(
        async (responseBuffer, proxyRes, req, _res) => {
          const contentType = proxyRes.headers["content-type"] || "";
          if (!contentType.includes("text/html")) return responseBuffer;
          if (!soloEnInicio(req)) return responseBuffer; // otras paginas: sin cambios
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
      `(carga +${SERVER_DELAY_MS}ms, form ${FORM_DELAY_MS}ms -> ${REDIRECT_TO})`
  );
});

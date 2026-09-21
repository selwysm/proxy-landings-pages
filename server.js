import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Origen del contenido real (subdominio DISTINTO al que sirve el proxy, para
// no crear un bucle). En produccion: https://origen.alexandramarin.co
const TARGET = process.env.TARGET || "https://clase.alexandramarin.co";

// Latencia artificial (ms) en la carga de la pagina (lado servidor).
const SERVER_DELAY_MS = Number(process.env.SERVER_DELAY_MS || 0);

// Duracion del overlay "Cargando..." al enviar el formulario (ms).
const FORM_DELAY_MS = Number(process.env.FORM_DELAY_MS || 30000);

// A donde redirigir despues de la carga lenta (pagina de gracias).
const REDIRECT_TO = process.env.REDIRECT_TO || "/gracias";

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

// Pagina de gracias (servida por el proxy).
app.get("/gracias", (_req, res) => {
  res.type("html").send(
    "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<title>Gracias</title></head>" +
      "<body style='font-family:system-ui,sans-serif;text-align:center;margin-top:90px;color:#222'>" +
      "<h1>¡Gracias! Tu cupo quedó reservado.</h1>" +
      "<p style='color:#555'>Te enviaremos los detalles muy pronto.</p>" +
      "</body></html>"
  );
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Proxy inverso hacia el contenido real, inyectando el script en el HTML.
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
      `(carga +${SERVER_DELAY_MS}ms, form ${FORM_DELAY_MS}ms -> ${REDIRECT_TO})`
  );
});

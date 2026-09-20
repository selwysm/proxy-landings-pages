import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Origen real que vamos a proxiar (la pagina con el formulario).
const TARGET = process.env.TARGET || "https://clase.alexandramarin.co";

// A donde redirigir despues de la "carga" simulada.
const REDIRECT_TO = process.env.REDIRECT_TO || "/gracias";

// Cuanto tiempo simular la mala conexion (milisegundos).
const DELAY_MS = Number(process.env.DELAY_MS || 30000);

// ---------------------------------------------------------------------------
// Script que se inyecta en el HTML: intercepta el envio del formulario,
// muestra una pantalla de "cargando" durante DELAY_MS y luego redirige.
// ---------------------------------------------------------------------------
const INYECCION = `
<script>
(function () {
  var DELAY = ${DELAY_MS};
  var DESTINO = ${JSON.stringify(REDIRECT_TO)};

  var estilo = document.createElement("style");
  estilo.textContent =
    "@keyframes __sp{to{transform:rotate(360deg)}}";
  document.head.appendChild(estilo);

  function mostrarCarga() {
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(255,255,255,.95);" +
      "display:flex;align-items:center;justify-content:center;" +
      "z-index:2147483647;font-family:sans-serif;color:#333";
    overlay.innerHTML =
      '<div style="text-align:center">' +
      '<div style="width:52px;height:52px;border:5px solid #ddd;' +
      "border-top-color:#555;border-radius:50%;margin:0 auto 18px;" +
      'animation:__sp 1s linear infinite"></div>' +
      "<p style=\\"font-size:16px\\">Cargando...</p></div>";
    document.body.appendChild(overlay);
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

// Pagina simple de "gracias" a la que redirigimos (servida por el proxy).
app.get("/gracias", (_req, res) => {
  res.send(
    "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>" +
      "<title>Gracias</title></head>" +
      "<body style='font-family:sans-serif;text-align:center;margin-top:80px'>" +
      "<h1>Listo, hemos recibido tu reserva.</h1></body></html>"
  );
});

// Chequeo de salud.
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Proxy inverso: reenvia todo al origen real e inyecta el script en el HTML.
// ---------------------------------------------------------------------------
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
          if (!contentType.includes("text/html")) {
            return responseBuffer; // imagenes, css, js: pasan tal cual
          }
          let html = responseBuffer.toString("utf8");
          if (html.includes("</body>")) {
            html = html.replace("</body>", INYECCION + "</body>");
          } else {
            html += INYECCION;
          }
          return html;
        }
      ),
    },
  })
);

app.listen(PORT, () => {
  console.log(
    `Proxy en puerto ${PORT} -> ${TARGET} (delay ${DELAY_MS}ms, redirige a ${REDIRECT_TO})`
  );
});

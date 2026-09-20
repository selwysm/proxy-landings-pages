# Proxy para evento.alexandramarin.co (Render)

Proxy inverso hecho en Node + Express que reenvia el trafico a tu sitio real
e intercepta el envio del formulario en la ruta `/enviar`.

## Correr en local

```bash
npm install
TARGET="https://vibe.ludicrous.cloud" npm run dev
# abre http://localhost:3000
```

## Desplegar en Render

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: New + -> Web Service -> conecta el repo.
3. Configuracion:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
4. En Environment agrega la variable:
   - `TARGET` = URL de tu sitio real (ej. `https://vibe.ludicrous.cloud`)
5. Deploy. Render te dara una URL tipo `https://tu-servicio.onrender.com`.

## Conectar el subdominio en GoDaddy

En Render: Settings -> Custom Domains -> agrega `evento.alexandramarin.co`.
Render te dara un valor CNAME. En GoDaddy edita el registro CNAME `evento`
para que apunte a ese valor (en vez de `vibe.ludicrous.cloud`).

## Donde meter tu logica

- `POST /enviar` en `server.js`: aqui capturas los datos del formulario y
  decides que hacer (guardar, enviar email, redirigir...).
- El resto de rutas se reenvian automaticamente al `TARGET`.

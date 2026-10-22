# Arquitectura

Documento interno de diseno: por que el proyecto esta hecho asi y donde tocar
para cada cambio.

## 1. Vista general

```
                 +-------------------+
                 |  platform/webos   |  Luna Service, boton Back, version
                 +-------------------+
                         |
   +---------+     +-----+------+     +-------------+
   |  core   | <-- |  services  | <-- |    data    |
   | bus dom |     | sources    |     | m3u xmltv  |
   | net     |     | epg        |     | xtream     |
   | storage |     | catalog    |     | demo       |
   | idb     |     | cache      |     +-------------+
   | logger  |     +-----+------+
   | url err |           |
   +---------+           |
          |              v
      +-----+-----+  +------------+    +--------------+
      |    ui     |  |  player    |    |  platform    |
      | shell     |  | nativo HLS |    |  MSE (opc.)  |
      | spatial   |  | reintentos |    +--------------+
      | router    |  +------------+
      | components|
      | views     |
      +-----------+
```

Reglas de dependencia:

- `core` no depende de nada del proyecto (solo de APIs del navegador).
- `data` depende de `core`.
- `services` depende de `core` y `data`.
- `player` depende de `core`.
- `ui` depende de `core`, `services`, `player` y `platform`.
- `main.js` es el unico punto que conoce a todos.

## 2. El problema del empaquetado

Una web app de webOS se sirve desde `file://`. En ese origen:

1. **Los ES Modules no cargan** (CORS bloquea `file://` como origen de un
   modulo). Solucion: `tools/bundle.mjs` concatena los modulos en un IIFE.
2. **Las peticiones HTTP fallan** salvo que el servidor acepte el origen
   `null`. Solucion: JS Service que descarga desde el propio SO.

El bundler es propio (unos 150 lineas) por dos motivos: el build no depende de
`node_modules` (reproducible en cualquier equipo) y el resultado es un IIFE
ES2019 que `terser` (el que usa `ares-package`) reduce sin problemas.

Restricciones que impone el bundler y que hay que respetar al escribir codigo:

- Solo `export const|let|var|function|class` (sin `export default`, sin
  `export { ... }`, sin `export *`).
- Solo imports con llaves y en una sola linea.
- Sin imports dinamicos (`import()`) ni `export * as`.
- Sin ciclos entre modulos: el empaquetador copia los bindings al cargar el
  modulo, asi que un ciclo daria valores `undefined`.

## 3. Navegacion con el mando

`src/ui/spatial.js` no conoce la disposicion de la pantalla: calcula el
destino a partir de `getBoundingClientRect()`.

- Se filtran los elementos con `data-focusable="true"` y visibles.
- En la direccion pulsada se descartan los que no estan en ese sentido.
- La puntuacion es `distancia_principal + 0.6 * distancia_perpendicular -
  solape`, con un bonus de -120 para preferir el mismo `data-nav-scope`
  (contenido, grupos, barra lateral, dialogo).
- Si no hay candidato en esa direccion, se mantiene el foco dentro del mismo
  ambito (comportamiento esperado en listas largas).

El atributo `data-nav-scope` es la pieza clave: permite que la barra lateral,
la fila de grupos y el contenido convivan sin que el foco "salte" a un sitio
inesperado.

## 4. Reproduccion

`src/player/player.js` define un contrato de adaptador:

```
load(src) -> Promise   play() / pause() / stop()
isLive() currentTime() duration() setVolume()
audioTracks() subtitleTracks() setAudioTrack()
on('error'|'buffering'|'time'|'duration', fn)
```

Dos implementaciones:

- **Nativo** (por defecto): `<video>` con HLS del televisor. Es lo que
  funciona en webOS TV 6.0 sin dependencias.
- **MSE**: requiere `window.shaka`; si no esta, falla con un error explicito
  (`unsupported`) en lugar de romperse en silencio. La libreria no se
  empaqueta.

El reproductor de alto nivel anade timeout de arranque, dos reintentos con
pausa y emision de eventos por el bus (`player:loading`, `player:playing`,
`player:error`, `player:failed`).

## 5. Datos y credenciales

- Las credenciales Xtream se guardan ofuscadas con `obfuscateSecret()`
  (base64 + XOR con clave derivada del `userAgent`).
- `deobfuscateSecret()` es la operacion inversa exacta (XOR simetrico con
  flujo dependiente de la posicion).
- El log (`src/core/logger.js`) redacta URLs con credenciales, parametros
  `password`/`username`/`token` y las rutas de Xtream
  (`/getlive/usuario/clave/...`).
- `hashPin()` guarda el PIN parental como hash no reversible.

Esto **no es cifrado**: una web app de webOS no tiene un almacen seguro de
credenciales. El README lo dice explicitamente para no dar una falsa
sensacion de seguridad.

## 6. Cache

Dos niveles:

- `services/cache.js`: memoria con TTL (playlist 30 min, EPG 6 h, catalogo
  1 h) y limite de entradas.
- `core/idb.js`: IndexedDB con respaldo automatico en memoria cuando el
  navegador no lo permite (modo privado, policies del SO).

Al activar una fuente se invalida su cache para forzar la recarga.

## 7. Gestion de errores

`core/errors.js` define codigos estables (`network`, `timeout`, `http`,
`parse`, `unsupported`, `not_found`, `storage`, `playback`, `empty`,
`unknown`) y un mensaje de usuario en espanol e ingles. `toNovaError()`
normaliza cualquier error lanzado y `userMessage()` lo traduce.

Las vistas nunca muestran la excepcion cruda: muestran `userMessage(err)`.

## 8. Pruebas

`tests/` usa `node:test` sin dependencias. Los modulos que necesitan DOM usan
dobles de prueba (un `<video>` simulado en `player.test.js`, nodos con
geometria en `spatial.test.js`), de modo que la suite corre en cualquier
entorno sin navegador.

Que no cubren (y por que): el renderizado real, la interaccion con el mando
físico y el comportamiento dentro de webOS. Para eso esta la vista de
diagnostico y el simulador oficial de LG.

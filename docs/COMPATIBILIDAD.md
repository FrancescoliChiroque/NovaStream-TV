# Informe de compatibilidad

Resumen de lo que la app puede hacer en cada version de **webOS TV**, con el
criterio que se ha seguido: el codigo solo usa sintaxis y APIs disponibles en
la version mas antigua soportada (webOS TV 6.0 / Chromium 79 / ES2019).

## 1. Versiones de webOS TV y su motor

| webOS TV | Chromium | Salida prevista | Estado |
|---|---|---|---|
| 4.x | 53 | 2016-2017 | **No soportado** (sin ES2015 completo, sin `fetch` fiable) |
| 5.x | 68 | 2018 | **No soportado** (falta `fetch` con `AbortController` fiable y ES Modules bloqueados) |
| **6.0** | **79** | **2019-2020** | **Minimo soportado** |
| 6.1 - 6.3 | 79 | 2020-2021 | Soportado |
| 22 | 87 | 2022 | Soportado |
| 23 | 94 | 2023 | Soportado |
| 24 | 108 | 2023-2024 | Soportado |
| 25 | 120 | 2024-2025 | Soportado |
| 26 | 132 | 2025+ | Soportado |

La app no necesita mas de Chromium 79 porque el nucleo usa `fetch`,
`AbortController`, `Promise`, `class`, template literals y `Object.assign`.

### webOS Hub: televisores HYLED, Hisense, AOC y otras marcas con licencia

Ademas de los LG, hay SMART TV de otras marcas (Hyundai/HYLED, Hisense, AOC,
Telefunken...) que usan **webOS Hub**, la version de webOS que LG licencia para
socios. En esos televisores el numero de version que muestra el sistema **no
sigue la numeracion de LG**: un modelo HYLED con version **04.56.35** no es un
webOS TV 4.0, es una plataforma moderna (webOS 22 o posterior).

| Indicador | Valor | Lectura |
|---|---|---|
| Version mostrada | `04.56.35` | Formato `04.xx.xx` tipico de webOS Hub |
| Modelos HYLED | `HYLED...` | Marca Hyundai con licencia webOS |
| Diagnostico de la app | `Plataforma: webOS Hub (licencia de marca) / HYLED` | Deteccion automatica |

Consecuencias practicas:

- El motor es un **Chromium reciente** (muy por encima de 79), asi que todo el
  codigo de la app es compatible.
- Se soportan **apps web**, **JS Service**, **Luna Service**, HLS nativo y el
  boton Atras (461) igual que en un LG.
- La app **detecta sola** la familia de plataforma en Diagnostico
  (`src/platform/webos.js` ▸ `detectPlatformFamily`).
- Lo unico que puede fallar es la **instalacion del IPK**: algunas
  compilaciones de webOS Hub noilen el demonio SSH del puerto 9922, que es lo
  que usa `ares-install`. Ver `docs/INSTALACION.md` ▸ "Si el televisor es
  webOS Hub" para las vias alternativas (navegador del TV con el servidor de
  desarrollo).

### Sintaxis prohibida en el bundle (verificada por `tools/verify-build.mjs`)

`?.` (optional chaining), `??` (nullish coalescing), `String.replaceAll`,
`Array/String.at`, `structuredClone`, `Object.hasOwn`, imports dinamicos.

## 2. Capacidades de reproduccion por version

Segun la documentacion oficial de streaming de webOS:

| Capacidad | Desde | Notas |
|---|---|---|
| HLS (M3U8) nativo en `<video>` | webOS TV 3.0 | Via de la app |
| Live seek (ir a un momento del directo) | webOS TV 3.0 | No hay avance rapido |
| Rebobinado en VOD | webOS TV 3.0 | Segun el contenedor |
| Velocidad de reproduccion distinta de 1x | **No soportado** | webOS fija la velocidad |
| `EXT-X-PROGRAM-DATE-TIME` (hora del directo) | **No soportado** | La guia se cruza por EPG |
| MPEG-DASH nativo | **No soportado** | Requiere MSE + Shaka |
| MSE (Media Source Extensions) | webOS TV 6.0 | Disponible en el minimo soportado |
| EME / DRM (Widevine) | webOS TV 6.0 | El soporte de Widevine depende del modelo y del fabricante |
| Subtitles (WebVTT) en `<video>` | webOS TV 4.0 | A traves de `textTracks` |

**Conclusion**: la app usa el motor nativo HLS y por eso no necesita Shaka
para el uso habitual. El adaptador MSE existe en `src/player/player.js` pero la
libreria **no se incluye** en el paquete; si un dia se necesita (DASH, DRM o
streams con segmentos fMP4), se deja el fichero del motor en `vendor/` y se
activa en Ajustes ▸ Reproduccion ▸ "MSE (Shaka)".

## 3. Webpack de la app (tipo "web") frente al motor nativo

webOS permite empaquetar una aplicacion nativa (C/C++) o una web app. Aqui se
usa una **web app** (`"type": "web"` en `appinfo.json`), con estas
consecuencias:

- El motor es el Chromium del televisor, con sus codecs (H.264/HEVC) y sin DRM
  Widevine garantizado.
- No hay acceso a APIs nativas del SO, solo a **Luna Services** mediante
  `webOS.service.request`.
- El origen es `file://`, por lo que **CORS bloquea** la peticion directa a
  servidores IPTV que no envien `Access-Control-Allow-Origin: null`.
- Los `<script type="module">` **no funcionan** en origen `file://`: por eso
  el paquete usa un bundle IIFE clasico (`tools/bundle.mjs`).
- La libreria heredada `webOSTV.js` **sobrescribe** `window.webOS` con una
  implementacion que depende de `PalmServiceBridge`. En webOS 22+ y en webOS
  Hub el sistema ya expone el objeto global `webOS`, asi que `index.html`
  solo carga la libreria cuando el SO **no** aporta `webOS.service`
  (`index.html` ▸ bloque `boot()`). Si se cargara siempre, el proxy (JS
  Service) dejaria de funcionar en las plataformas nuevas.

## 4. Boton "Atras" (keyCode 461)

webOS envia la tecla 461 y, por defecto, el historial del navegador tambien
navega atras, lo que produce salidas no deseadas. La app lo resuelve asi:

1. `appinfo.json` incluye `"disableBackHistoryAPI": true`.
2. `src/ui/shell.js` gestiona la tecla 461: cierra el reproductor, cierra
   dialogos, vuelve a Inicio y, en Inicio, muestra su propio dialogo de
   salida (sin depender del popup del sistema, que no existe en todas las
   versiones).
3. La salida real la hace `platformBack()` (`webOS.platformBack()` si existe;
   si no, `window.close()`).

## 5. Almacenamiento

| Dato | Ubicacion | Se borra al |
|---|---|---|
| Ajustes, fuentes, favoritos, historial | `localStorage` | Reinstalar o actualizar la app |
| Cache grande (guias, catalogos) | IndexedDB | Al borrar datos desde Ajustes |
| PIN parental | `localStorage` (hash) | Igual que los ajustes |

Limitaciones conocidas:

- `localStorage` esta limitado a unos 16 MB y **se borra al actualizar la
  app**: las fuentes guardadas deben poder reescribirse.
- No existe un almacen seguro de credenciales en una web app de webOS. Las
  credenciales Xtream se guardan ofuscadas (base64 + XOR con una clave
  derivada del dispositivo). **No es cifrado** y el usuario debe saberlo.
- Los logs redaccionan credenciales automaticamente (`src/core/logger.js`).

## 6. Red

| Situacion | Comportamiento |
|---|---|
| Fuente con cabeceras CORS correctas | Peticion directa desde el navegador |
| Fuente sin CORS | Se reintenta a traves del **JS Service** `com.novastream.tv.fetch` |
| Origen `file://` (IPK) | Se prioriza el proxy si esta disponible |
| App abierta en el navegador del TV (sin instalar) | Se usa el proxy del servidor de desarrollo (`/api/fetch`) |
| Servidor lento | Timeout de 12 s (listas) / 15 s (streams) con reintentos y backoff |
| Respuesta enorme | Se corta a 12 MB (lista) / 24 MB (guia) |

El JS Service es un servicio Node.js del propio televisor: hace la peticion
desde el SO (sin CORS), sigue hasta 3 redirecciones, descomprime gzip/deflate
y limita el tamano de la respuesta. Solo admite `http` y `https`.

## 7. Lo que NO se ha podido verificar

- **No hay televisor fisico disponible** en el entorno de desarrollo: la app no
  se ha ejecutado en un webOS real. Todo lo anterior se apoya en la
  documentacion oficial de LG y en el diseno defensivo del codigo.
- **No se ha ejecutado el simulador** de webOS TV (es una aplicacion grafica
  y este entorno no tiene display).
- La **interfaz no se ha visto renderizada**: no hay navegador disponible en
  este entorno. Las pruebas cubren la logica (navegacion espacial con nodos
  simulados), no el aspecto final.
- El **proxy (JS Service)** no se ha ejecutado dentro de webOS: su logica se
  ha probado de forma aislada, pero la llamada Luna desde la app no.

Por eso la app incluye la vista **Ajustes ▸ Diagnostico**: en el televisor real
se puede comprobar en un minuto la version de webOS, la disponibilidad del
proxy, el espacio usado y la respuesta de la fuente.

Cuando la app se abre en el **navegador del televisor** no hay Luna Service, asi
que los datos del dispositivo se deducen del propio navegador (user agent,
version de webOS y resolucion); la vista indica expresamente si esta siendo
ejecutada como app instalada o en el navegador.

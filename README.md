# NovaStream TV

Cliente IPTV para televisores con **webOS TV** (Hyundai, LG y otros) escrito en
HTML5, CSS3 y JavaScript modular. No es un fork de ninguna app existente: el
código, la interfaz y la arquitectura son originales de este proyecto.

![webOS](https://img.shields.io/badge/webOS-6.0%2B-4f7cff) ![JavaScript](https://img.shields.io/badge/JavaScript-ES2019-f7df1e) ![Licencia](https://img.shields.io/badge/licencia-MIT-23c9a0)

---

## 1. Que hace

- **Canales en directo** desde una lista M3U/M3U8 o desde un servicio
  **Xtream Codes** (categorias, VOD y series con capitulos).
- **Guia electronica (XMLTV)**: programa en curso y siguiente por canal.
- **Peliculas y series** cuando la fuente lo permite.
- **Favoritos, historial y "continuar viendo"** guardados en el televisor.
- **Busqueda** rapida sobre la lista cargada.
- **Control parental** con PIN (activable por categorias).
- **Navegacion 100% con el mando**: foco espacial, barra lateral y dialogos.
- **Modo diagnostico** en el propio televisor: version de webOS, motor,
  almacenamiento, prueba de red y registro de errores.

## 2. Requisitos

| Elemento | Detalle |
|---|---|
| Televisor | webOS TV 6.0 o superior (probado el diseno contra Chromium 79 / ES2019) |
| Desarrollo | Node.js 18+ (probado con 22) |
| Empaquetado | `@webos-tools/cli` (CLI oficial de LG) |
| Red | La fuente debe permitir HLS nativo; el proxy opcional evita el bloqueo CORS |

> webOS TV 6.0 corresponde a los televisores de 2019-2020. En modelos con
> webOS 22-26 la app funciona igual y ademas dispone de MSE, EME y mejores
> capacidades de red.
>
> **Televisores con webOS Hub** (HYLED de Hyundai, Hisense, AOC y otras
> marcas con licencia de webOS): son plataformas modernas, la app es compatible
> y las detecta automaticamente en **Ajustes ▸ Diagnostico**. Su version
> (`04.56.35`, por ejemplo) no sigue la numeracion de LG. Si en ellos no se
> puede instalar el IPK porque el firmware no expone el puerto SSH 9922, la
> app se puede probar desde el navegador del propio televisor con
> `npm run dev` (ver `docs/INSTALACION.md`).

## 3. Estructura del proyecto

```
.
├── appinfo.json                 Metadatos de la app web para webOS
├── index.html                   Punto de entrada (modulos en dev, bundle en el IPK)
├── src/
│   ├── main.js                  Arranque: servicios, montaje y teclado
│   ├── config.js                Constantes, TTL, teclas y ajustes por defecto
│   ├── core/
│   │   ├── bus.js               Bus de eventos
│   │   ├── dom.js               Utilidades DOM (sin framework)
│   │   ├── errors.js            Errores centralizados con codigo estable
│   │   ├── idb.js               IndexedDB con respaldo en memoria
│   │   ├── logger.js            Log con niveles y redaccion de credenciales
│   │   ├── net.js               Timeouts, reintentos, limite de concurrencia, proxy
│   │   ├── storage.js           Preferencias, fuentes, favoritos, historial
│   │   └── url.js               Validacion de URLs (solo http/https)
│   ├── data/
│   │   ├── m3u.js               Parser de listas M3U
│   │   ├── xmltv.js             Parser de guia XMLTV
│   │   ├── xtream.js            Cliente de la API Xtream Codes
│   │   └── demo.js              Streams publicos de prueba
│   ├── services/
│   │   ├── cache.js             Cache en memoria con TTL
│   │   ├── catalog.js           Peliculas y series
│   │   ├── epg.js               Guia electronica
│   │   └── sources.js           Fuentes (M3U y Xtream) y su ciclo de vida
│   ├── player/
│   │   └── player.js            Adaptadores (nativo HLS / MSE) y reintentos
│   ├── platform/
│   │   └── webos.js             Luna Service, boton Back, version, proxy
│   └── ui/
│       ├── shell.js             Layout, rutas, teclado global, salida
│       ├── spatial.js           Navegacion espacial por geometria
│       ├── router.js            Enrutador por hash
│       ├── components/          Tarjetas, filas, listas, dialogos, reproductor
│       └── views/               Inicio, canales, catalogo, busqueda, ajustes...
├── service/
│   └── com.novastream.tv.fetch/ JS Service (proxy de descarga)
├── styles/main.css              Estilos (tema oscuro, foco visible, 10-foot UI)
├── tests/                       Pruebas unitarias (node:test)
├── tools/                       Bundler, iconos, servidor de dev, empaquetado
└── docs/                        Informes y manuales
```

Documentacion:

| Documento | Contenido |
|---|---|
| `docs/ARQUITECTURA.md` | Como esta montado el proyecto y por que |
| `docs/COMPATIBILIDAD.md` | Versiones de webOS soportadas y limitaciones |
| `docs/INSTALACION.md` | Instalacion en el televisor y diagnostico |

## 4. Puesta en marcha

### 4.1 Desarrollo en el navegador

```bash
npm run dev        # servidor local en http://localhost:3000
```

En `http://` la app carga los modulos ES nativos; en el IPK (que se sirve desde
`file://`) carga el bundle clasico generado por `tools/bundle.mjs`. El motivo
es que Chromium bloquea `<script type="module">` en origen `file://`.

El servidor de desarrollo imprime tambien la direccion de red (`http://192.168.x.x:3000/`)
para abrir la app **desde el navegador del televisor**, y expone
`/api/fetch?url=...` como equivalente del JS Service para evitar el bloqueo
CORS cuando la app no esta instalada.

### 4.2 Build y empaquetado

```bash
npm install --save-dev @webos-tools/cli   # CLI oficial de LG
npm run build                              # bundle + iconos + assets + verificacion
npm run package:ipk                        # genera dist/com.novastream.tv_1.0.0_all.ipk
```

`npm run build` ejecuta ademas `tools/verify-build.mjs`, que comprueba que el
bundle no usa sintaxis posterior a ES2019 (optional chaining, `??`,
`replaceAll`, `structuredClone`...) para que no falle en webOS TV 6.0.

El IPK generado contiene **la app y el JS service** en el mismo paquete:

```
usr/palm/applications/com.novastream.tv/    (index.html, app.bundle.js, estilos, iconos)
usr/palm/services/com.novastream.tv.fetch/  (proxy de descarga)
```

### 4.3 Instalacion en el televisor

Ver `docs/INSTALACION.md`. Resumen:

```bash
# Con el televisor en modo desarrollador (Ajustes ▸ General ▸ Poner en modo desarrollador)
ares-install -d <IP_DEL_TV> dist/com.novastream.tv_1.0.0_all.ipk
```

## 5. Uso

1. En **Ajustes ▸ Fuentes ▸ Anadir fuente** introduce una URL M3U o los datos
   de Xtream Codes (servidor, usuario y contrasena).
2. Activa la fuente; la app la descarga y la guarda en cache.
3. Navega con las flechas; **ENTER** reproduce, **atras** (461) vuelve al menu y
   **boton verde** anade a favoritos.
4. En **Diagnostico** comprueba la version de webOS, si el proxy esta
   disponible y si la fuente responde.

Atajos dentro del reproductor: volumen con izquierda/derecha, informacion con
el boton de informacion, salir con atras.

## 6. Pruebas

```bash
npm test
```

126 pruebas unitarias con `node:test` (sin dependencias externas) sobre:

| Fichero | Cobertura |
|---|---|
| `tests/m3u.test.js` | Parser M3U, atributos, grupos, ids estables |
| `tests/xmltv.test.js` | Parser XMLTV, CDATA, zonas horarias, guia en curso |
| `tests/url.test.js` | Validacion de URLs, join, query, deteccion de HLS |
| `tests/storage.test.js` | Preferencias, fuentes, favoritos, historial, ofuscacion |
| `tests/net.test.js` | Timeouts, reintentos, limites de tamano, proxy del JS service, proxy local y modo de red |
| `tests/cache.test.js` | TTL, limite de entradas, invalidacion |
| `tests/sources.test.js` | Ciclo de vida de fuentes y cache de la playlist |
| `tests/epg.test.js` | Carga e indexado de la guia |
| `tests/player.test.js` | Adaptador nativo, errores de media, reintentos, MSE ausente |
| `tests/spatial.test.js` | Navegacion espacial con el mando |
| `tests/dialog.test.js` | Dialogos modales: navegacion, cierre y campos de texto |
| `tests/keyboard.test.js` | Teclado en pantalla: escritura, mayus, simbolos y confirmacion |
| `tests/shell.test.js` | Integracion del shell: teclado, dialogos y foco por ambito |
| `tests/settings.test.js` | Formulario de fuentes: campos, alta y descarga de la lista |
| `tests/history.test.js` | Guarda del boton atras en modo navegador (historial) |
| `tests/platform.test.js` | Deteccion de plataforma (LG webOS / webOS Hub) |
| `tests/logger.test.js` | Redaccion de credenciales en el log |
| `tests/errors.test.js` | Errores centralizados: codigo, mensaje y texto para el usuario |

## 7. Decisiones tecnicas relevantes

- **Compatibilidad antes que modernidad**: el codigo evita la sintaxis que no
  existe en Chromium 79 para que la app funcione en webOS TV 6.0.
- **CORS**: una app empaquetada se sirve desde `file://` (origen `null`), por
  lo que la peticion directa a un servidor IPTV suele ser rechazada. Se
  incluye un **JS Service** que descarga desde el propio televisor. Si no esta
  disponible, la app intenta la peticion directa.
- **Credenciales**: se guardan **ofuscadas** (base64 + XOR con clave local),
  nunca en claro ni en los logs. No es cifrado: `localStorage` de webOS no es
  un almacen seguro. Es lo unico posible en una app web.
- **Render**: DOM directo sin framework, con creacion de nodos por vista y
  reutilizacion, para no castigar la CPU del televisor.
- **Navegacion**: el foco se calcula con la geometria real de los elementos
  (`getBoundingClientRect`), no con coordenadas fijas, de modo que la misma
  logica sirve en cualquier tamano de pantalla.

## 8. Limitaciones conocidas

- **Sin DRM**: la app no implementa Widevine; solo reproduce contenido
  desprotegido (HLS/TS/MP4). Las cuentas con DRM necesitan un motor externo
  (Shaka + Widevine) que se documenta como adaptador opcional, no incluido.
- **Sin DASH nativo**: webOS TV no reproduce MPEG-DASH de forma nativa; solo
  con MSE + Shaka.
- **En directo**: no hay avance ni rebobinado en HLS en directo (limite del
  propio sistema), y no hay cambio de velocidad de reproduccion.
- **Carga de imagenes**: los logotipos se cargan de servidores externos; si el
  servidor no envia cabeceras CORS adecuadas el navegador puede bloquearlos, y la
  app cae al marcador de texto.
- **Sin busqueda "a la carta"**: la busqueda работа sobre la lista ya
  descargada, no sobre el catalogo remoto.
- **Sin instalacion de dependencias**: el proyecto no usa `node_modules` para
  construir (el bundler es propio) para que el build sea reproducible.

## 9. Publicacion en la tienda de LG

Este proyecto esta pensado para uso personal (sideloading). Para publicarlo en
la LG Content Store hacen falta, ademas del codigo:

- Declarar los **ACG** (Access Control Group) correspondientes en
  `appinfo.json` (`requiredACG`), incluido el acceso al JS Service propio.
- Declarar los contenidos por edad, la ficha de la tienda y los textos en
  ingles.
- Cumplir las Politicas de Contenido de LG para aplicaciones de television.

Consulta la guia oficial de ACG:
<https://webostv.developer.lge.com/develop/guides/acg-guide>

## 10. Licencia

MIT para el codigo propio. `vendor/webOSTVjs-1.2.13/` mantiene su licencia
original (Apache-2.0, LG Electronics).

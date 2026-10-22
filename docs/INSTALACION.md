# Instalacion en el televisor

## 1. Preparar el televisor (modo desarrollador)

1. En el televisor: **Ajustes ▸ General ▸ Poner en modo desarrollador** y
   activarlo.
2. **Ajustes ▸ Red ▸ Conexion con el mundo** (o "Puerto de desarrollo y
   depuracion"): ponerlo en **Permitido**.
3. Averigua la IP del televisor (Ajustes ▸ Red ▸ Informacion de red ▸
   Direccion IP).
4. En el ordenador, comprueba que el puerto 9922 esta accesible:

   ```bash
   nc -vz 192.168.1.50 9922
   ```

> El modo desarrollador es una funcion de webOS TV 4.0 en adelante. En
> algunos modelos solo aparece si el firmware es reciente y el televisor esta
> conectado a internet.

## 2. Instalar el IPK

### Opcion A: linea de comandos (recomendada)

```bash
npm run build
npm run package:ipk
npx @webos-tools/cli ares-install -d 192.168.1.50 dist/com.novastream.tv_1.0.0_all.ipk
```

El IPK contiene la app **y** el JS Service, asi que no hay que instalar nada
mas.

### Opcion B: pendrive USB

1. Copia el `.ipk` en un pendrive formateado en FAT32.
2. En el televisor: **Ajustes ▸ General ▸ Reproducir archivos del pendrive**
   (o "Aplicaciones ▸ Aplicaciones de TV ▸ USB").
3. Selecciona el `.ipk` y confirma.

Algunos modelos mas recientes requieren la aplicacion "Easy IPTV" de la tienda
para instalar IPKs desde USB.

## 2-bis. Si el televisor es webOS Hub (HYLED, Hisense, AOC...)

Los SMART TV de marca con licencia **webOS Hub** (por ejemplo los HYLED de
Hyundai, con version `04.56.35`) no siempre traen el demonio SSH que usa
`ares-install`. Si el puerto 9922 no responde:

```bash
nc -vz 192.168.1.50 9922     # "Connection refused" = no hay SSH
```

La app se puede probar **sin instalar nada**, con el navegador integrado del
televisor:

1. En el PC, con el PC y el TV en la misma red:

   ```bash
   npm run dev
   # muestra algo como: Desde el televisor (misma red): http://192.168.1.20:3000/
   ```

   > En Windows, la primera vez el Firewall de Windows pregunta si permites
   > las conexiones de Node.js en la red privada: hay que aceptarlo. Si se
   > rechaza, el TV no podra abrir la pagina. Se puede crear la regla con:
   >
   > ```powershell
   > netsh advfirewall firewall add rule name="NovaStream dev" dir=in action=allow protocol=TCP localport=3000
   > ```

2. En el TV, abre el navegador (app "Navegador" o "Web Browser") y entra en
   esa direccion.
3. La app detecta que no hay Luna Service y usa el **proxy del servidor de
   desarrollo** (`/api/fetch`) para las descargas, de modo que las listas se
   cargan igual aunque el servidor IPTV no envie cabeceras CORS.

Diferencias del modo navegador frente al IPK:

| | IPK (instalada) | Navegador del TV |
|---|---|---|
| Descargas | JS Service en el propio TV | Proxy en el PC |
| Boton atras | Gestionado por la app | Gestionado por la app (guarda de historial) |
| Almacenamiento | `localStorage` del TV | `localStorage` del navegador del TV |
| Proxy | Incluido en el paquete | Requiere el PC encendido |

Cuando el firmware del TV incluya el daemon SSH, la instalacion del IPK
funciona como siempre (`npm run package:ipk` + `ares-install`).

## 3. Primer arranque
1. Abre **NovaStream TV** desde la lista de aplicaciones.
2. Ve a **Ajustes ▸ Fuentes ▸ Anadir fuente**:
   - **M3U**: nombre y URL de la lista (`http://.../lista.m3u`).
   - **Xtream Codes**: nombre, servidor, usuario, contrasena y (opcional) la
     URL de la guia XMLTV.
3. Selecciona la fuente y pulsa **Activar**.
4. La app la descarga y ya se puede navegar.

### 3-bis. Probarlo sin tener proveedor

Si todavia no tienes una lista, el propio repositorio trae una fuente de
demostracion que usa flujos publicos de prueba (no son canales de TV):

| Tipo | Valor |
|---|---|
| M3U | `http://<ip-del-pc>:3000/demo/demo.m3u` |
| Guia XMLTV | `http://<ip-del-pc>:3000/demo/epg.xml` |
| Xtream (servidor) | `http://<ip-del-pc>:3000/xtream` |
| Xtream (usuario / contrasena) | `demo` / `demo` |

La URL del PC es la que imprime `npm run dev` ("Desde el televisor..."). Las
tres opciones necesitan el servidor de desarrollo en marcha.

Ademas, la vista **Demostracion** del menu lateral reproduce flujos publicos
sin configurar ninguna fuente: sirve para comprobar el reproductor, el audio y
la navegacion con el mando.

### 3-ter. Escribir con el mando

En los televisores el teclado del sistema no aparece al pulsar un campo de
texto (y en algunos navegadores de webOS no existe). Por eso la app trae un
**teclado en pantalla**:

- Mueve el foco hasta un campo (nombre, URL, usuario, contrasena, PIN,
  busqueda) y pulsa **OK**: se abre el teclado en pantalla.
- Escribe con las flechas y **OK**; **MAYUS** cambia a mayusculas, **123**
  cambia a numeros y simbolos, **ESPACIO**, **BORRAR**, **OK** confirma y
  **CANCELAR** cierra sin confirmar.
- **Atras** o **ESC** cierran el teclado y vuelven al campo.

## 4. Si la lista no se descarga

Es el problema mas habitual y casi siempre es **CORS**: una app empaquetada
se sirve desde `file://` y su origen es `null`, de modo que el servidor IPTV
rechaza la peticion del navegador.

La app lo resuelve con el **JS Service** `com.novastream.tv.fetch`, que va
incluido en el mismo IPK y descarga desde el propio televisor. Para
comprobarlo:

1. Abre **Ajustes ▸ Diagnostico**.
2. Mira la linea **Proxy (JS Service)**: deberia poner "disponible".
3. Pulsa **Probar la fuente activa**.

Si el proxy no aparece como disponible:

- Comprueba que el IPK se instalo completo (el service va dentro del mismo
  paquete).
- En algunos firmwares hay que reiniciar el televisor tras instalar un JS
  Service nuevo.
- Alternativa: usar un servidor propio que reenvie las peticiones y envie
  `Access-Control-Allow-Origin: *`.

## 5. Diagnostico de problemas

| Sintoma | Causa probable | Solucion |
|---|---|---|
| La app no aparece en la lista | IPK no instalado o modo desarrollador desactivado | Repite la instalacion, reinicia el televisor |
| `ares-install` da "Connection refused" en el puerto 9922 | Firmware de webOS Hub sin daemon SSH | Usa el modo navegador (seccion 2-bis) |
| "No se pudo cargar la lista" | CORS o servidor caido | Diagnostico ▸ Probar la fuente activa |
| Los logos no se ven | El servidor de imagenes no envia CORS | Es cosmetico; la app usa el nombre del canal |
| El video no arranca | Codec no soportado o URL caducada | Prueba un canal de la vista Demostracion |
| Se ve el video pero no hay audio | Pista de audio no compatible o pista seleccionada mal | Ajustes ▸ Diagnostico ▸ pista de audio |
| El boton atras sale de la app | firmware antiguo que ignora `disableBackHistoryAPI` | Actualiza el firmware |

## 6. Desinstalar

```bash
npx @webos-tools/cli ares-remove -d 192.168.1.50 com.novastream.tv
```

Tambien se puede desinstalar desde el propio televisor:
**Ajustes ▸ Aplicaciones ▸ Aplicaciones de TV ▸ NovaStream TV ▸ Desinstalar**.
Al desinstalar se borran ajustes, fuentes, favoritos e historial (viven en el
`localStorage` de la app).

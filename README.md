# SmartCustoms NI

Sistema web para elaborar declaraciones aduaneras, administrar clientes y productos, y sacar recibos en PDF.
Funciona de dos maneras, sin cambiar nada del sistema:

| Modo | Cómo se usa | Dónde se guardan los datos |
|---|---|---|
| **Local** | Abrir `login.html` o publicar en GitHub Pages | En el navegador de cada persona |
| **Con servidor (SQLite)** | `npm start` o publicar con el servidor | En una base de datos SQLite compartida por todos |

La web detecta sola en qué modo está. Usuario inicial: **admin** / **admin123** (cámbiela al entrar).

---

## 1. Probarlo en su computadora (2 minutos)

1. Instale [Node.js](https://nodejs.org) **versión 22.13 o mayor** (botón «LTS»).
2. Abra una terminal dentro de esta carpeta y escriba:
   ```
   npm start
   ```
3. Abra <http://localhost:3000> en el navegador. Arriba/abajo verá la etiqueta verde **«Base de datos conectada»**.

No hay que instalar nada más: el servidor usa el SQLite que ya trae Node. La base queda en `data/smartcustoms.db`.

## 2. Publicarlo para tener un dominio

### Opción A (recomendada): Render con disco
1. Suba la carpeta a un repositorio de GitHub (`git add . && git commit -m "listo" && git push`).
2. En <https://render.com> → **New → Blueprint** y elija el repositorio. Render lee `render.yaml` solo.
3. Cuando le pida `SC_ACCESO`, escriba un usuario y clave, por ejemplo `smart:UnaClaveLarga123`.
4. Al terminar, Render le da una dirección tipo `https://smartcustoms-ni.onrender.com`.

> **Importante:** el disco persistente solo existe en planes de pago de Render. En el plan gratis **la base SQLite se borra** cada vez que el servicio se reinicia o se «duerme» (a los 15 min sin visitas). [Fuente: Render](https://render.com/docs/free)

### Opción B: Fly.io (volumen para la base)
1. Instale `flyctl` y entre con `fly auth login`.
2. Cambie `app` en `fly.toml` por un nombre único.
3. `fly launch --no-deploy --copy-config`, luego `fly volumes create datos --size 1` y `fly deploy`.
4. Para pedir clave de acceso: `fly secrets set SC_ACCESO="smart:UnaClaveLarga123"`.

### Opción C: GitHub Pages (gratis, sin base de datos)
Funciona como hasta ahora: dirección `https://su-usuario.github.io/SmartCustoms_NI/`, pero cada navegador guarda sus propios datos. Sirve para demostraciones. Después de subir cambios, pulse **Ctrl + F5** para ver la versión nueva.

Cualquier otro hosting con Docker sirve usando el `Dockerfile` (monte un volumen en `/data`).

## 3. Variables de configuración (opcionales)

| Variable | Para qué sirve | Ejemplo |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `SC_DB` | Dónde guardar el archivo de la base | `/var/data/smartcustoms.db` |
| `SC_ACCESO` | Pide `usuario:clave` antes de abrir la web (recomendado en internet) | `smart:UnaClaveLarga123` |

## 4. Respaldos y consultas

- **Respaldo en un clic:** Configuración → *Base de datos* → «Descargar copia de la base de datos (.db)».
- **Ver los datos:** abra esa copia con [DB Browser for SQLite](https://sqlitebrowser.org). Tablas: `usuarios`, `clientes`, `productos`, `declaraciones`, `kv`.
- **Informes por SQL**, ejemplo (declaraciones y total CIF por mes):
  ```sql
  SELECT substr(fecha_iso,1,7) AS mes, COUNT(*) AS cantidad, SUM(total_cif) AS cif
  FROM declaraciones GROUP BY mes ORDER BY mes;
  ```
- Informes ya hechos: `/api/informes/resumen` (JSON; acepta `?desde=2026-01-01&hasta=2026-12-31`) y `/api/informes/declaraciones.csv` (abre en Excel).

## 5. Cómo adaptar la base de datos

Todo está en `server/db.js`, en el bloque `COLECCIONES`:
- **Nueva columna** (para poder consultarla con SQL): agréguela en `columnas` de esa tabla. Al arrancar se crea sola, sin borrar datos.
- **Nueva tabla:** agregue una entrada con su clave del navegador y su nombre de tabla, y súmela a `TODAS`/`COLECCIONES` en `js/sync.js`.

Cada registro se guarda completo (JSON) en la columna `datos`, así que agregar campos nuevos en los formularios no rompe nada.

## 6. Lo que hay que saber (límites)

- **Seguridad:** el inicio de sesión sigue siendo del navegador (igual que antes). La lista de usuarios, con sus claves cifradas de forma sencilla, viaja al navegador. Por eso, en internet use siempre `SC_ACCESO`, y no cargue datos aduaneros reales hasta contar con un inicio de sesión validado en el servidor.
- **Varios usuarios a la vez:** si dos personas editan la misma lista al mismo tiempo, gana el último guardado. Cada página se actualiza con la base al abrirla.
- **Sin servidor** (modo local) todo funciona como siempre, con los datos en el navegador.

## 7. Estructura

```
index.html, login.html, ...   páginas de la web
css/estilos.css               estilos originales
css/profesional.css           capa visual (adaptable a celular, tablet y pantallas grandes)
js/sync.js                    conecta la web con la base de datos (si hay servidor)
js/recibo.js                  recibo en PDF (sin XML)
server/server.js, db.js       servidor y base SQLite (sin dependencias)
data/                         aquí se crea smartcustoms.db
render.yaml, fly.toml, Dockerfile   archivos de publicación
```

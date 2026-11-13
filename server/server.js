// SmartCustoms NI - servidor
// Sirve la web y guarda los datos en SQLite. No necesita instalar paquetes (solo Node 22.13 o mayor).
//
// Variables opcionales (ver README.md):
//   PORT         puerto (por defecto 3000)
//   SC_DB        ruta del archivo de base de datos (por defecto ./data/smartcustoms.db)
//   SC_ACCESO    "usuario:clave" para pedir una clave antes de abrir la web (recomendado en internet)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { abrir, crearAlmacen, COLECCIONES, CLAVES_KV } = require('./db.js');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = parseInt(process.env.PORT) || 3000;
const RUTA_DB = path.resolve(process.env.SC_DB || path.join(RAIZ, 'data', 'smartcustoms.db'));
const ACCESO = (process.env.SC_ACCESO || '').trim();
const VERSION = require('../package.json').version;

const db = abrir(RUTA_DB);
const almacen = crearAlmacen(db);

// ---------- archivos de la web ----------

const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
// solo se publican estas carpetas y las paginas .html de la raiz (nunca server/, data/ ni .git)
const CARPETAS_PUBLICAS = ['css', 'js', 'img'];

function rutaPublica(urlPath) {
    let p;
    try { p = decodeURIComponent(urlPath); } catch (e) { return null; }
    if (p.includes('\0') || p.includes('\\')) return null;
    if (p == '/') p = '/login.html';
    const partes = p.split('/').filter(Boolean);
    if (partes.some((x) => x.startsWith('.') || x == '..')) return null;
    const ext = path.extname(p).toLowerCase();
    if (!TIPOS[ext]) return null;
    if (partes.length == 1) {
        if (!(ext == '.html' || ['favicon.ico', 'manifest.webmanifest', 'robots.txt'].includes(partes[0]))) return null;
    } else if (!CARPETAS_PUBLICAS.includes(partes[0])) {
        return null;
    }
    const completa = path.resolve(RAIZ, ...partes);
    return completa.startsWith(RAIZ + path.sep) ? completa : null;
}

function enviarArchivo(req, res, ruta) {
    let st;
    try { st = fs.statSync(ruta); } catch (e) { return false; }
    if (!st.isFile()) return false;
    const ext = path.extname(ruta).toLowerCase();
    const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const cabeceras = {
        'Content-Type': TIPOS[ext] || 'application/octet-stream',
        'ETag': etag,
        // paginas, estilos y scripts siempre se revisan (asi los cambios se ven al instante);
        // las imagenes se guardan una semana
        'Cache-Control': ['.png', '.jpg', '.jpeg', '.svg', '.ico'].includes(ext) ? 'public, max-age=604800' : 'no-cache'
    };
    if (req.headers['if-none-match'] == etag) { res.writeHead(304, cabeceras); res.end(); return true; }
    cabeceras['Content-Length'] = st.size;
    res.writeHead(200, cabeceras);
    if (req.method == 'HEAD') res.end(); else fs.createReadStream(ruta).pipe(res);
    return true;
}

// ---------- respuestas ----------

function json(res, codigo, obj) {
    const cuerpo = JSON.stringify(obj);
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(cuerpo);
}

function leerCuerpo(req, max = 8 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let tam = 0; const trozos = [];
        req.on('data', (t) => {
            tam += t.length;
            if (tam > max) { reject(new Error('Demasiado grande')); req.destroy(); return; }
            trozos.push(t);
        });
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(trozos).toString('utf8') || 'null')); } catch (e) { reject(new Error('JSON no valido')); } });
        req.on('error', reject);
    });
}

function iguales(a, b) {
    const x = crypto.createHash('sha256').update(a).digest();
    const y = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(x, y);
}

// clave de acceso opcional (HTTP Basic) para toda la web
function accesoPermitido(req) {
    if (!ACCESO) return true;
    const h = req.headers['authorization'] || '';
    if (!h.startsWith('Basic ')) return false;
    return iguales(Buffer.from(h.slice(6), 'base64').toString('utf8'), ACCESO);
}

// ---------- API ----------

async function api(req, res, url) {
    const ruta = url.pathname;

    // las escrituras solo se aceptan desde esta misma web
    if (req.method != 'GET' && req.method != 'HEAD') {
        const origen = req.headers['origin'];
        if (req.headers['x-sc'] != '1' || (origen && new URL(origen).host != req.headers['host'])) {
            return json(res, 403, { error: 'No permitido' });
        }
    }

    if (ruta == '/api/estado' && req.method == 'GET') {
        return json(res, 200, { ok: true, version: VERSION, ...almacen.estado(RUTA_DB) });
    }
    if (ruta == '/api/snapshot' && req.method == 'GET') {
        return json(res, 200, almacen.snapshot());
    }
    let m;
    if ((m = ruta.match(/^\/api\/coleccion\/([a-z_]+)$/)) && req.method == 'PUT') {
        if (!COLECCIONES[m[1]]) return json(res, 404, { error: 'Coleccion desconocida' });
        const n = almacen.guardarColeccion(m[1], await leerCuerpo(req));
        return json(res, 200, { ok: true, guardados: n });
    }
    if ((m = ruta.match(/^\/api\/kv\/([a-z_]+)$/)) && req.method == 'PUT') {
        if (!CLAVES_KV.includes(m[1])) return json(res, 404, { error: 'Clave desconocida' });
        const cuerpo = await leerCuerpo(req);
        almacen.guardarKv(m[1], cuerpo ? cuerpo.valor : null);
        return json(res, 200, { ok: true });
    }
    if (ruta == '/api/informes/resumen' && req.method == 'GET') {
        return json(res, 200, almacen.resumen(url.searchParams.get('desde'), url.searchParams.get('hasta')));
    }
    if (ruta == '/api/informes/declaraciones.csv' && req.method == 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="declaraciones.csv"', 'Cache-Control': 'no-store'
        });
        return res.end(almacen.declaracionesCsv(url.searchParams.get('desde'), url.searchParams.get('hasta')));
    }
    if (ruta == '/api/respaldo' && req.method == 'GET') {
        const tmp = path.join(path.dirname(RUTA_DB), 'respaldo-' + crypto.randomBytes(4).toString('hex') + '.tmp');
        almacen.copiarA(tmp);
        const fecha = new Date().toISOString().slice(0, 10);
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store',
            'Content-Length': fs.statSync(tmp).size,
            'Content-Disposition': `attachment; filename="smartcustoms_${fecha}.db"`
        });
        const flujo = fs.createReadStream(tmp);
        flujo.pipe(res);
        const limpiar = () => fs.unlink(tmp, () => {});
        flujo.on('close', limpiar); res.on('close', limpiar);
        return;
    }
    return json(res, 404, { error: 'No existe' });
}

// ---------- servidor ----------

const servidor = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');

    const url = new URL(req.url, 'http://localhost');

    // para que el hosting sepa que el servidor esta vivo (sin pedir clave)
    if (url.pathname == '/salud') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

    if (!accesoPermitido(req)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="SmartCustoms NI", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Se necesita el acceso para entrar.');
    }

    try {
        if (url.pathname.startsWith('/api/')) return await api(req, res, url);
        if (req.method != 'GET' && req.method != 'HEAD') { res.writeHead(405); return res.end(); }
        const ruta = rutaPublica(url.pathname);
        if (ruta && enviarArchivo(req, res, ruta)) return;
        // pagina no encontrada
        res.statusCode = 404;
        if (!enviarArchivoConCodigo(req, res, path.join(RAIZ, '404.html'), 404)) res.end('No encontrado');
    } catch (e) {
        console.error('Error:', e.message);
        if (!res.headersSent) json(res, 400, { error: e.message });
        else res.end();
    }
});

function enviarArchivoConCodigo(req, res, ruta, codigo) {
    try {
        const cuerpo = fs.readFileSync(ruta);
        res.writeHead(codigo, { 'Content-Type': TIPOS['.html'], 'Content-Length': cuerpo.length });
        res.end(req.method == 'HEAD' ? undefined : cuerpo);
        return true;
    } catch (e) { return false; }
}

servidor.listen(PUERTO, '0.0.0.0', () => {
    console.log(`SmartCustoms NI listo en http://localhost:${PUERTO}`);
    console.log(`Base de datos: ${RUTA_DB}`);
    if (!ACCESO) console.log('Aviso: SC_ACCESO no esta definido; cualquiera con el enlace puede abrir la web.');
});

function cerrar() {
    servidor.close(() => { try { db.close(); } catch (e) { /* ya cerrada */ } process.exit(0); });
    setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);

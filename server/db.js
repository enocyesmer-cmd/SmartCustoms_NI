// SmartCustoms NI - base de datos SQLite
// Usa el SQLite que ya trae Node (node:sqlite): no hay que instalar nada.
//
// COMO AGREGAR UNA TABLA NUEVA: sume una linea en COLECCIONES (abajo).
// COMO AGREGAR UNA COLUMNA A UNA TABLA: sume el campo en "columnas".
// Al arrancar, el servidor crea lo que falte sin borrar datos.
//
// Cada registro se guarda completo en la columna "datos" (JSON) y, ademas, los
// campos mas utiles van en columnas normales para poder consultarlos con SQL
// (por ejemplo desde DB Browser for SQLite).

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

// clave que usa la web en el navegador -> tabla de la base de datos
const COLECCIONES = {
    sc_usuarios: {
        tabla: 'usuarios',
        columnas: { usuario: 'TEXT', nombre: 'TEXT', rol: 'TEXT', activo: 'INTEGER' },
        extra: (r) => ({ activo: r.activo ? 1 : 0 })
    },
    sc_clientes: {
        tabla: 'clientes',
        columnas: { codigo: 'TEXT', nombre: 'TEXT', tipo: 'TEXT', ruc: 'TEXT', telefono: 'TEXT', correo: 'TEXT' }
    },
    sc_productos: {
        tabla: 'productos',
        columnas: { partida: 'TEXT', descripcion: 'TEXT', origen: 'TEXT', procedimiento: 'TEXT' }
    },
    smartcustoms_declaraciones: {
        tabla: 'declaraciones',
        columnas: {
            referencia: 'TEXT', tipo: 'TEXT', cliente: 'TEXT', aduana: 'TEXT', fecha: 'TEXT',
            fecha_iso: 'TEXT', estado: 'TEXT', usuario: 'TEXT', total_cif: 'REAL'
        },
        extra: (r) => {
            const f = String(r.fecha || '').split('/');           // dd/mm/yyyy -> yyyy-mm-dd
            return {
                fecha_iso: f.length == 3 ? f[2] + '-' + f[1] + '-' + f[0] : '',
                total_cif: parseFloat(r.campos && r.campos['Total CIF']) || 0
            };
        }
    }
};

// valores sueltos (datos del declarante, contador de recibos)
const CLAVES_KV = ['sc_config', 'sc_recibos_generados'];

const MAX_REGISTROS = 20000;

function abrir(rutaDb) {
    fs.mkdirSync(path.dirname(rutaDb), { recursive: true });
    const db = new DatabaseSync(rutaDb);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');

    db.exec(`CREATE TABLE IF NOT EXISTS kv (
        clave TEXT PRIMARY KEY, valor TEXT NOT NULL, actualizado TEXT NOT NULL)`);

    for (const def of Object.values(COLECCIONES)) {
        db.exec(`CREATE TABLE IF NOT EXISTS ${def.tabla} (
            id TEXT PRIMARY KEY,
            orden INTEGER NOT NULL DEFAULT 0,
            datos TEXT NOT NULL,
            actualizado TEXT NOT NULL)`);
        // columnas nuevas (si se agregaron en COLECCIONES despues de crear la tabla)
        const existentes = db.prepare(`PRAGMA table_info(${def.tabla})`).all().map((c) => c.name);
        for (const [col, tipo] of Object.entries(def.columnas)) {
            if (!existentes.includes(col)) db.exec(`ALTER TABLE ${def.tabla} ADD COLUMN ${col} ${tipo}`);
        }
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_decl_estado ON declaraciones(estado)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_decl_fecha ON declaraciones(fecha_iso)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario COLLATE NOCASE)');
    return db;
}

function ahora() { return new Date().toISOString(); }

function crearAlmacen(db) {
    // ----- lectura -----
    function leerColeccion(clave) {
        const def = COLECCIONES[clave];
        return db.prepare(`SELECT datos FROM ${def.tabla} ORDER BY orden`).all().map((f) => JSON.parse(f.datos));
    }

    function snapshot() {
        const datos = {};
        let vacio = true;
        for (const clave of Object.keys(COLECCIONES)) {
            datos[clave] = leerColeccion(clave);
            if (datos[clave].length) vacio = false;
        }
        for (const f of db.prepare('SELECT clave, valor FROM kv').all()) {
            datos[f.clave] = f.valor;
            vacio = false;
        }
        return { vacio, datos };
    }

    // ----- escritura -----
    // reemplaza toda la coleccion (la web siempre manda la lista completa)
    function guardarColeccion(clave, lista) {
        const def = COLECCIONES[clave];
        if (!def) throw new Error('Coleccion desconocida');
        if (!Array.isArray(lista) || lista.length > MAX_REGISTROS) throw new Error('Lista no valida');

        const nombres = Object.keys(def.columnas);
        const sql = `INSERT INTO ${def.tabla} (id, orden, datos, actualizado${nombres.map((n) => ', ' + n).join('')})
            VALUES (?, ?, ?, ?${nombres.map(() => ', ?').join('')})
            ON CONFLICT(id) DO UPDATE SET orden=excluded.orden, datos=excluded.datos, actualizado=excluded.actualizado
            ${nombres.map((n) => ', ' + n + '=excluded.' + n).join('')}`;
        const upsert = db.prepare(sql);
        const ts = ahora();
        const ids = new Set();

        db.exec('BEGIN');
        try {
            // primero se borra lo que ya no esta (evita choques con indices unicos)
            lista.forEach((reg) => {
                if (!reg || typeof reg !== 'object' || reg.id === undefined || reg.id === null) throw new Error('Registro sin id');
                const id = String(reg.id);
                if (ids.has(id)) throw new Error('Id repetido');
                ids.add(id);
            });
            const borrar = db.prepare(`DELETE FROM ${def.tabla} WHERE id = ?`);
            for (const f of db.prepare(`SELECT id FROM ${def.tabla}`).all()) if (!ids.has(f.id)) borrar.run(f.id);

            lista.forEach((reg, i) => {
                const extra = def.extra ? def.extra(reg) : {};
                const valores = nombres.map((n) => {
                    let v = n in extra ? extra[n] : reg[n];
                    if (v === undefined || v === null) v = def.columnas[n] === 'TEXT' ? '' : 0;
                    return typeof v === 'object' ? JSON.stringify(v) : v;
                });
                upsert.run(String(reg.id), i, JSON.stringify(reg), ts, ...valores);
            });
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
        return lista.length;
    }

    function guardarKv(clave, valor) {
        if (!CLAVES_KV.includes(clave)) throw new Error('Clave desconocida');
        if (valor === null || valor === undefined) {
            db.prepare('DELETE FROM kv WHERE clave = ?').run(clave);
        } else {
            if (typeof valor !== 'string' || valor.length > 100000) throw new Error('Valor no valido');
            db.prepare(`INSERT INTO kv (clave, valor, actualizado) VALUES (?, ?, ?)
                ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado=excluded.actualizado`)
                .run(clave, valor, ahora());
        }
    }

    // ----- informes (SQL) -----
    function filtroFechas(desde, hasta) {
        const w = []; const p = [];
        if (/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) { w.push('fecha_iso >= ?'); p.push(desde); }
        if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) { w.push('fecha_iso <= ?'); p.push(hasta); }
        return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
    }

    function resumen(desde, hasta) {
        const { where, params } = filtroFechas(desde, hasta);
        const q = (sql) => db.prepare(sql).all(...params);
        return {
            totales: q(`SELECT COUNT(*) AS declaraciones, COALESCE(SUM(total_cif),0) AS total_cif FROM declaraciones ${where}`)[0],
            por_estado: q(`SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(total_cif),0) AS total_cif FROM declaraciones ${where} GROUP BY estado ORDER BY cantidad DESC`),
            por_mes: q(`SELECT substr(fecha_iso,1,7) AS mes, COUNT(*) AS cantidad, COALESCE(SUM(total_cif),0) AS total_cif FROM declaraciones ${where} GROUP BY mes ORDER BY mes`),
            por_cliente: q(`SELECT cliente, COUNT(*) AS cantidad, COALESCE(SUM(total_cif),0) AS total_cif FROM declaraciones ${where} GROUP BY cliente ORDER BY total_cif DESC LIMIT 10`),
            por_aduana: q(`SELECT aduana, COUNT(*) AS cantidad FROM declaraciones ${where} GROUP BY aduana ORDER BY cantidad DESC`),
            por_usuario: q(`SELECT usuario, COUNT(*) AS cantidad FROM declaraciones ${where} GROUP BY usuario ORDER BY cantidad DESC`)
        };
    }

    function declaracionesCsv(desde, hasta) {
        const { where, params } = filtroFechas(desde, hasta);
        const filas = db.prepare(`SELECT referencia, cliente, aduana, fecha, estado, usuario, total_cif FROM declaraciones ${where} ORDER BY orden`).all(...params);
        const celda = (t) => '"' + String(t ?? '').replace(/"/g, '""') + '"';
        const lineas = [['Referencia', 'Cliente', 'Aduana', 'Fecha', 'Estado', 'Registrada por', 'CIF'].join(',')];
        for (const f of filas) lineas.push([f.referencia, f.cliente, f.aduana, f.fecha, f.estado, f.usuario, f.total_cif].map(celda).join(','));
        return '﻿' + lineas.join('\r\n');
    }

    function estado(rutaDb) {
        const tablas = {};
        for (const def of Object.values(COLECCIONES)) {
            tablas[def.tabla] = db.prepare(`SELECT COUNT(*) AS n FROM ${def.tabla}`).get().n;
        }
        let tamano = 0;
        for (const sufijo of ['', '-wal']) {
            try { tamano += fs.statSync(rutaDb + sufijo).size; } catch (e) { /* no existe */ }
        }
        return { motor: 'SQLite', archivo: path.basename(rutaDb), tamano, tablas };
    }

    // copia consistente de toda la base (para el boton de respaldo)
    function copiarA(destino) {
        try { fs.unlinkSync(destino); } catch (e) { /* no existia */ }
        db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
    }

    return { snapshot, guardarColeccion, guardarKv, resumen, declaracionesCsv, estado, copiarA };
}

module.exports = { abrir, crearAlmacen, COLECCIONES, CLAVES_KV };

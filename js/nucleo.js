// SmartCustoms NI - nucleo (se carga en todas las paginas)
// Une lo que antes eran 5 archivos: sync.js, datos.js, iconos.js, validaciones.js y app.js.
// El orden importa: sync va primero (antes que datos) y app al final.

// ============================================================
// 1. SYNC - conexion con la base de datos (antes sync.js)
// ============================================================

// Va primero en este archivo (antes que los datos) y se carga en todas las paginas.
//
// Como funciona (para no tocar el resto del sistema):
//  - Si la web corre con el servidor (server/server.js), al abrir cada pagina se copian los
//    datos de la base de datos al navegador, y cada vez que el sistema guarda algo, se envia
//    tambien a la base de datos.
//  - Si no hay servidor (por ejemplo abierta desde un archivo o en GitHub Pages), no hace nada
//    y la web sigue funcionando como siempre, guardando en el navegador.

(function () {
    var COLECCIONES = ['sc_usuarios', 'sc_clientes', 'sc_productos', 'smartcustoms_declaraciones'];
    var VALORES = ['sc_config', 'sc_recibos_generados'];
    var TODAS = COLECCIONES.concat(VALORES);

    // estado que lee el resto de la web: 'local' | 'conectada' | 'guardando' | 'error'
    window.SC_DB = { modo: 'local', estado: 'local' };

    if (location.protocol != 'http:' && location.protocol != 'https:') return;

    // ---------- 1. traer los datos de la base de datos ----------
    // si ya se comprobo en esta sesion que no hay servidor, no se vuelve a preguntar en cada pagina
    try { if (sessionStorage.getItem('sc_sin_servidor') == '1') return; } catch (e) { /* sin sessionStorage */ }

    var respuesta;
    try {
        var x = new XMLHttpRequest();
        x.open('GET', 'api/snapshot', false);   // sincrono: los datos deben estar antes de que la pagina arranque
        x.send();
        if (x.status != 200 || (x.getResponseHeader('Content-Type') || '').indexOf('json') == -1) {
            try { sessionStorage.setItem('sc_sin_servidor', '1'); } catch (e) { /* ignorar */ }
            return;   // sin servidor: modo local
        }
        respuesta = JSON.parse(x.responseText);
    } catch (e) {
        return;
    }

    var guardarNativo = Storage.prototype.setItem;
    var borrarNativo = Storage.prototype.removeItem;
    window.SC_DB.modo = 'servidor';
    window.SC_DB.estado = 'conectada';

    // ---------- 2. enviar cambios a la base de datos ----------
    var pendientes = {};
    var temporizador = null;
    var enVuelo = 0;
    var hayError = false;

    function mostrar(estado) {
        var antes = window.SC_DB.estado;
        window.SC_DB.estado = estado;
        if (estado == 'error' && antes != 'error' && window.mostrarAviso) {
            mostrarAviso('No se pudo guardar en la base de datos. Se reintentará solo.');
        }
        var pastilla = document.getElementById('estadoBD');
        if (pastilla) pintarPastilla(pastilla);
    }

    function enviar(clave) {
        var valor = localStorage.getItem(clave);
        var esLista = COLECCIONES.indexOf(clave) != -1;
        var url = (esLista ? 'api/coleccion/' : 'api/kv/') + clave;
        var cuerpo = esLista ? (valor === null ? '[]' : valor) : JSON.stringify({ valor: valor });

        enVuelo++;
        mostrar('guardando');
        return fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-SC': '1' },
            body: cuerpo,
            keepalive: cuerpo.length < 60000   // asi no se pierde si cambian de pagina enseguida
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            delete pendientes[clave];
        }).catch(function () {
            pendientes[clave] = true;
            hayError = true;
        }).then(function () {
            enVuelo--;
            if (enVuelo == 0) {
                var quedan = Object.keys(pendientes).length > 0;
                hayError = quedan;
                mostrar(quedan ? 'error' : 'conectada');
            }
        });
    }

    function vaciarCola() {
        temporizador = null;
        Object.keys(pendientes).forEach(enviar);
    }

    function programar(clave) {
        pendientes[clave] = true;
        if (!temporizador) temporizador = setTimeout(vaciarCola, 60);
    }

    // el sistema guarda con localStorage.setItem / removeItem: se avisa a la base de datos
    Storage.prototype.setItem = function (clave) {
        guardarNativo.apply(this, arguments);
        if (this === window.localStorage && TODAS.indexOf(clave) != -1) programar(clave);
    };
    Storage.prototype.removeItem = function (clave) {
        borrarNativo.apply(this, arguments);
        if (this === window.localStorage && TODAS.indexOf(clave) != -1) programar(clave);
    };

    // si algo no se pudo enviar (se cayo internet), se reintenta cada 10 segundos
    setInterval(function () {
        if (Object.keys(pendientes).length && enVuelo == 0) vaciarCola();
    }, 10000);
    window.addEventListener('online', function () { if (Object.keys(pendientes).length) vaciarCola(); });
    window.addEventListener('beforeunload', function (e) {
        if (hayError) { e.preventDefault(); e.returnValue = ''; }
    });

    // ---------- 3. aplicar lo que habia en la base de datos ----------
    if (respuesta.vacio) {
        // base nueva: se suben los datos que ya hubiera en este navegador (no se pierde nada)
        TODAS.forEach(function (clave) {
            if (localStorage.getItem(clave) !== null) programar(clave);
        });
    } else {
        // la base de datos manda: este navegador queda igual a ella
        TODAS.forEach(function (clave) {
            var d = respuesta.datos[clave];
            if (d === undefined) borrarNativo.call(localStorage, clave);
            else guardarNativo.call(localStorage, clave, typeof d == 'string' ? d : JSON.stringify(d));
        });
    }

    // ---------- 4. indicador visible para el usuario ----------
    var TEXTOS = {
        conectada: ['Base de datos conectada', 'ok'],
        guardando: ['Guardando…', 'trabajando'],
        error: ['Sin conexión: reintentando', 'error']
    };

    function pintarPastilla(el) {
        var t = TEXTOS[window.SC_DB.estado] || TEXTOS.conectada;
        el.className = 'estado-bd ' + t[1];
        el.textContent = t[0];
        el.title = 'Los cambios se guardan en la base de datos del servidor';
    }

    window.addEventListener('load', function () {
        // la pastilla va dentro del menu lateral, arriba de los botones de sesion
        var caja = document.querySelector('.usuario-box');
        if (!caja) return;
        var el = document.createElement('span');
        el.id = 'estadoBD';
        el.setAttribute('role', 'status');
        pintarPastilla(el);
        caja.insertBefore(el, caja.firstChild);

        // la nota de Configuracion decia que los datos viven en el navegador
        var notas = document.querySelectorAll('p.nota');
        for (var i = 0; i < notas.length; i++) {
            if (notas[i].textContent.indexOf('viven en este navegador') != -1) {
                notas[i].textContent = 'Los datos se guardan en la base de datos SQLite del servidor. Aun así conviene descargar un respaldo de vez en cuando.';
            }
        }
    });
})();

// ============================================================
// 2. DATOS - datos, sesion y permisos (antes datos.js)
// ============================================================

// OJO: todo se guarda en el navegador (localStorage). Sirve para practicar,
// pero no es seguridad real: para eso se necesita un servidor.

var K = {
    usuarios: 'sc_usuarios',
    clientes: 'sc_clientes',
    productos: 'sc_productos',
    config: 'sc_config',
    recibos: 'sc_recibos_generados',
    declaraciones: 'smartcustoms_declaraciones',
    sesion: 'sc_sesion'
};

var ROLES = ['declarante', 'revisor', 'administrador'];

// que roles pueden entrar a cada pagina
var PERMISOS = {
    inicio: ROLES,
    nueva: ['declarante', 'administrador'],
    buscar: ROLES,
    clientes: ROLES,
    productos: ROLES,
    reportes: ['revisor', 'administrador'],
    configuracion: ['administrador'],
    ayuda: ROLES
};

// ---------- atajos que se usan en todos lados ----------

function $(id) {
    return document.getElementById(id);
}

// busca en la lista el elemento con ese id (undefined si no esta)
function porId(lista, id) {
    return lista.find(function (x) { return x.id == id; });
}

// deja vacios los campos con esos ids
function vaciarCampos(ids) {
    ids.forEach(function (id) { $(id).value = ''; });
}

// ejecuta fn cada vez que se escriba en alguno de los campos
function alEscribir(ids, fn) {
    ids.forEach(function (id) { $(id).addEventListener('input', fn); });
}

// ---------- lectura y escritura ----------

// lee de localStorage. Si no hay nada, esta danado o no es del mismo tipo
// que "vacio" (lista u objeto), devuelve "vacio"
function leerJSON(clave, vacio) {
    try {
        var d = JSON.parse(localStorage.getItem(clave));
        return (d && typeof d == 'object' && Array.isArray(d) == Array.isArray(vacio)) ? d : vacio;
    } catch (e) {
        return vacio;
    }
}

function leerLista(clave) {
    return leerJSON(clave, []);
}

// datos del declarante
function leerConfig() {
    return leerJSON(K.config, {});
}

// cuantos recibos se han generado (si venia el contador viejo de XML, se aprovecha)
function leerRecibos() {
    return parseInt(localStorage.getItem(K.recibos)) || parseInt(localStorage.getItem('sc_xml_generados')) || 0;
}

// guarda lo que le pasen; devuelve false si no se pudo (almacenamiento lleno o bloqueado)
function guardarLista(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
        return true;
    } catch (e) {
        if (window.mostrarAviso) mostrarAviso('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado');
        return false;
    }
}

// id unico con la hora mas un numero al azar
function nuevoId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// ---------- claves ----------

// hash sencillo (cyrb53) con un texto fijo. No es de nivel produccion.
function hashClave(texto) {
    var t = 'smartcustoms-ni:' + texto;
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < t.length; i++) {
        var ch = t.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// si no hay usuarios se crea el administrador inicial
function crearUsuarioInicial() {
    var lista = leerLista(K.usuarios);
    if (lista.length == 0) {
        lista.push({ id: nuevoId(), usuario: 'admin', nombre: 'Administrador', rol: 'administrador',
            claveHash: hashClave('admin123'), activo: true });
        guardarLista(K.usuarios, lista);
    }
}

// ---------- sesion ----------

// devuelve el usuario que esta dentro, o null
function sesionActual() {
    try {
        return JSON.parse(sessionStorage.getItem(K.sesion));
    } catch (e) {
        return null;
    }
}

// devuelve texto de error, o '' si entro bien
function iniciarSesion(usuario, clave) {
    // despues de 5 fallos seguidos se bloquea un rato (cada vez mas largo)
    var bloqueo = leerBloqueo();
    if (bloqueo.hasta > Date.now()) {
        return 'Demasiados intentos. Espere ' + Math.ceil((bloqueo.hasta - Date.now()) / 1000) + ' segundos';
    }
    if (usuario.length > 30 || clave.length > 64) return fallarLogin(bloqueo);

    var u = leerLista(K.usuarios).find(function (x) {
        return x.usuario.toLowerCase() == usuario.toLowerCase();
    });
    if (!u || u.claveHash != hashClave(clave)) return fallarLogin(bloqueo);
    if (!u.activo) return 'Este usuario está desactivado';

    localStorage.removeItem('sc_bloqueo');
    sessionStorage.setItem(K.sesion, JSON.stringify({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol }));
    return '';
}

// cuantos fallos lleva el login
function leerBloqueo() {
    var b = leerJSON('sc_bloqueo', {});
    return { n: Number(b.n) || 0, hasta: Number(b.hasta) || 0, veces: Number(b.veces) || 0 };
}

// suma un fallo; al quinto bloquea 30 s, luego 60 s, 120 s... (maximo 10 min)
function fallarLogin(bloqueo) {
    if (++bloqueo.n >= 5) {
        bloqueo.veces++;
        bloqueo.n = 0;
        bloqueo.hasta = Date.now() + Math.min(30000 * Math.pow(2, bloqueo.veces - 1), 600000);
    }
    guardarLista('sc_bloqueo', bloqueo);
    return 'Usuario o contraseña incorrectos';
}

// borra la sesion y manda al login
function cerrarSesion() {
    sessionStorage.removeItem(K.sesion);
    window.location.href = 'login.html';
}

// mira en PERMISOS si el rol puede entrar a esa pagina
function puedeVerPagina(pagina, rol) {
    return (PERMISOS[pagina] || []).indexOf(rol) != -1;
}

// revisor solo consulta clientes y productos
function puedeModificarCatalogos(rol) {
    return rol != 'revisor';
}

// se ejecuta al cargar cada pagina
function protegerPagina() {
    var pagina = document.body.getAttribute('data-pagina');
    crearUsuarioInicial();
    if (pagina == 'login') return;

    // manda a otra pagina y avisa al resto del codigo que no siga
    function salir(url) {
        window.sinAcceso = true;
        window.location.replace(url);
    }

    // el usuario pudo ser borrado o desactivado mientras tenia la sesion abierta
    var s = sesionActual();
    var u = s && leerLista(K.usuarios).find(function (x) { return x.id == s.id && x.activo; });
    if (!u) {
        sessionStorage.removeItem(K.sesion);
        return salir('login.html');
    }

    // por si le cambiaron el rol o el nombre
    s.rol = u.rol;
    s.nombre = u.nombre;
    sessionStorage.setItem(K.sesion, JSON.stringify(s));

    if (!puedeVerPagina(pagina, s.rol)) salir('index.html?sinpermiso=1');
}

// se llama aqui mismo, antes de que la pagina termine de cargar
protegerPagina();

// ============================================================
// 3. ICONOS (antes iconos.js)
// ============================================================

// Son los mismos de la carpeta archivo/icons/, pero metidos aqui como texto para que
// se vean aunque la pagina se abra directo desde el disco (sin servidor).
// Se pintan con "currentColor", asi toman el color del texto donde esten.

var ICONOS = {
    'arrow-left': '<path d="m12 19-7-7 7-7M5 12h14"/>',
    'bell': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    'brain': '<path d="M12 18V5a3 3 0 0 0-5.8-1A3.5 3.5 0 0 0 4 10a3.5 3.5 0 0 0 1 6.5A3.5 3.5 0 0 0 12 18Z"/><path d="M12 18V5a3 3 0 0 1 5.8-1A3.5 3.5 0 0 1 20 10a3.5 3.5 0 0 1-1 6.5A3.5 3.5 0 0 1 12 18ZM8 8h.01M16 8h.01M8 14h.01M16 14h.01"/>',
    'calendar': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    'chart': '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 6-7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'dashboard': '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    'download': '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'file-search': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6"/><path d="M14 2v6h6M14 13h3"/><circle cx="17" cy="17" r="3"/><path d="m19.2 19.2 2 2"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    'filter': '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
    'help': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    'grid': '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    'list': '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    'logout': '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
    'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'package': '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'printer': '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 12h.01"/>',
    'save': '<path d="M5 3h12l4 4v14H3V3Z"/><path d="M7 3v6h10V3M7 21v-7h10v7"/>',
    'search': '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'shield': '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    'trash': '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
    'truck': '<path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
};

// devuelve el icono como <img> con el svg metido en la propia direccion (data:).
// Se hace asi y no con <svg> directo porque hay navegadores de celular y visores
// de archivos que no pintan el svg que se mete con javascript.
// El icono sale azul; donde el fondo es oscuro el css lo vuelve blanco (filter).
var guardados = {};   // para no armar el mismo icono muchas veces

function icono(nombre, clase) {
    if (!guardados[nombre]) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ' +
            'fill="none" stroke="#0b3d91" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            (ICONOS[nombre] || '') + '</svg>';
        guardados[nombre] = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    return '<img class="ico ' + (clase || '') + '" src="' + guardados[nombre] + '" width="18" height="18" alt="">';
}

// cambia cada <i data-ico="nombre"></i> del html por su icono
function pintarIconos() {
    var lista = document.querySelectorAll('i[data-ico]');
    for (var i = 0; i < lista.length; i++) {
        lista[i].outerHTML = icono(lista[i].getAttribute('data-ico'));
    }
}

// ============================================================
// 4. VALIDACIONES (antes validaciones.js)
// ============================================================

// Reglas que se repiten en varias paginas. Cada formulario las usa antes de guardar.

// formatos permitidos
var PATRON = {
    codigo: /^[A-Za-z0-9._-]{1,15}$/,        // codigos de cliente, declarante
    referencia: /^[A-Za-z0-9 _-]{1,20}$/,    // referencia DUA, manifiesto
    partida: /^[0-9]{8}$/,                   // partida arancelaria
    pais: /^[A-Za-z]{2}$/,                   // US, NI, CN...
    aduana: /^[0-9]{4}$/,                    // 0610
    procedimiento: /^[0-9]{1,4}$/,           // 4000
    usuario: /^[A-Za-z0-9._-]{3,20}$/,
    ruc: /^[A-Za-z0-9-]{3,20}$/,
    telefono: /^[0-9+() -]{6,20}$/,
    correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
};

// quita espacios de mas y caracteres de control (saltos raros, etc)
function limpiarEspacios(texto) {
    return String(texto == null ? '' : texto)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// true si el texto tiene entre min y max caracteres
function largoOk(texto, min, max) {
    return texto.length >= min && texto.length <= max;
}

// numero valido y no negativo (acepta vacio solo si vacioOk)
function numeroValido(texto, vacioOk) {
    if (texto === '' || texto === null) return !!vacioOk;
    var n = Number(texto);
    return isFinite(n) && n >= 0 && n < 1e12;
}

// la fecha del input date (yyyy-mm-dd) no puede ser futura ni absurda
function fechaValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    var f = new Date(texto + 'T00:00:00');
    if (isNaN(f.getTime())) return false;
    var hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    return f <= hoy && f.getFullYear() >= 2000;
}

// pone limites a los inputs de una pagina para que no peguen textos enormes
function limitarCampos(contenedor, maximoTexto) {
    var inputs = (contenedor || document).querySelectorAll('input, textarea');
    for (var i = 0; i < inputs.length; i++) {
        var t = inputs[i].type;
        if ((t == 'text' || t == 'email' || t == 'tel' || t == 'password') && !inputs[i].hasAttribute('maxlength')) {
            inputs[i].setAttribute('maxlength', maximoTexto || 80);
        }
        if (t == 'number') {
            inputs[i].setAttribute('min', '0');
            inputs[i].setAttribute('step', 'any');
        }
    }
}

// al escribir en un campo marcado en rojo, se le quita la marca
function quitarMarcaAlEscribir() {
    document.addEventListener('input', function (e) {
        if (e.target.classList) e.target.classList.remove('error');
    });
}

// ventana con la lista de problemas encontrados
function mostrarErrores(titulo, lista) {
    var html = '<div class="modal"><h2>' + escaparHTML(titulo) + '</h2><ul class="lista-errores">';
    for (var i = 0; i < lista.length && i < 12; i++) {
        html += '<li>' + escaparHTML(lista[i]) + '</li>';
    }
    if (lista.length > 12) html += '<li>... y ' + (lista.length - 12) + ' más</li>';
    html += '</ul><div class="botones"><button onclick="cerrarModal()">Entendido</button></div></div>';
    abrirModal(html);
}

// ============================================================
// 5. APP - menu lateral, ventanas y utilidades (antes app.js)
// ============================================================

var CLAVE_EDITAR = 'smartcustoms_editar';   // marca para editar desde la busqueda

// ---------- menu lateral ----------

// arma el menu lateral segun el rol del usuario
function dibujarMenu() {
    var pagina = document.body.getAttribute('data-pagina');
    var enDecl = (pagina == 'nueva' || pagina == 'buscar');
    var ses = sesionActual();
    var rol = ses.rol;

    // devuelve el <li> solo si el rol puede entrar a esa pagina
    function item(clave, texto, enlace, ico) {
        if (!puedeVerPagina(clave, rol)) return '';
        return '<li class="' + (pagina == clave ? 'activo' : '') + '"><a href="' + enlace + '">' + icono(ico) + texto + '</a></li>';
    }

    var html = '';
    html += '<div class="logo"><img src="img/logo-recortado.png" alt="SmartCustoms NI"></div>';
    html += '<ul>';
    html += item('inicio', 'Dashboard', 'index.html', 'dashboard');
    html += item('clientes', 'Clientes', 'clientes.html', 'users');
    html += item('productos', 'Productos', 'productos.html', 'package');

    html += '<li class="' + (enDecl ? 'activo abierto' : '') + '" id="itemDeclaraciones">';
    html += '<span id="btnDecl">' + icono('file-text') + 'Declaraciones <b class="flecha">&#9660;</b></span>';
    html += '<ul id="submenuDeclaraciones" class="submenu' + (enDecl ? ' show' : '') + '">';
    html += item('nueva', 'Nueva Declaración', 'nueva_declaracion.html', 'plus');
    html += item('buscar', 'Buscar Declaración', 'buscar_declaracion.html', 'file-search');
    html += '</ul></li>';

    html += item('reportes', 'Reportes', 'reportes.html', 'chart');
    html += item('configuracion', 'Configuración', 'configuracion.html', 'settings');
    html += item('ayuda', 'Ayuda', 'ayuda.html', 'help');
    html += '</ul>';

    html += '<div class="usuario-box">';
    html += '<b>' + escaparHTML(ses.nombre) + '</b>';
    html += '<small>' + ses.rol + '</small>';
    html += '<button id="btnClave" class="btn-claro">' + icono('shield') + 'Cambiar contraseña</button>';
    html += '<button id="btnSalirMenu" class="btn-claro">' + icono('logout') + 'Cerrar sesión</button>';
    html += '</div>';

    $('menu').innerHTML = html;
    $('btnDecl').onclick = toggleMenu;
    $('btnClave').onclick = cambiarClave;
    $('btnSalirMenu').onclick = cerrarSesion;
}

// abre o cierra el submenu de declaraciones
function toggleMenu() {
    $('submenuDeclaraciones').classList.toggle('show');
}

// ---------- celular ----------

// abre (true) o cierra (false) el menu en pantallas chicas
function menuMovil(abrir) {
    $('menu').classList.toggle('abierta', abrir);
    $('fondoMenu').classList.toggle('visible', abrir);
}

// eventos del menu para celular: boton, fondo oscuro, escape y cambio de tamano
function prepararMovil() {
    var fondo = document.createElement('div');
    fondo.id = 'fondoMenu';
    fondo.className = 'fondo-menu';
    document.body.appendChild(fondo);

    fondo.onclick = function () { menuMovil(false); };
    $('btnMenu').onclick = function () {
        menuMovil(!$('menu').classList.contains('abierta'));
    };

    // al tocar un enlace del menu se cierra
    $('menu').addEventListener('click', function (e) {
        if (e.target.tagName == 'A') menuMovil(false);
    });

    // si giran el telefono o agrandan la ventana
    window.addEventListener('resize', function () {
        if (window.innerWidth > 800) menuMovil(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key == 'Escape') menuMovil(false);
    });
}

// pone data-label en cada celda para que la tabla se vea como fichas en el celular
function etiquetarTablas() {
    var tablas = document.querySelectorAll('table');
    for (var t = 0; t < tablas.length; t++) {
        var ths = tablas[t].querySelectorAll('th');
        if (ths.length == 0) continue;
        tablas[t].classList.add('apilar');

        var filas = tablas[t].querySelectorAll('tr');
        for (var f = 0; f < filas.length; f++) {
            var celdas = filas[f].querySelectorAll('td');
            for (var c = 0; c < celdas.length; c++) {
                if (ths[c] && !celdas[c].hasAttribute('colspan')) celdas[c].setAttribute('data-label', ths[c].textContent);
            }
        }
    }
}

// ---------- utilidades ----------

// mensajito que sale abajo a la derecha y se quita solo
function mostrarAviso(texto) {
    var aviso = $('aviso');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso';
        aviso.className = 'aviso';
        document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.classList.add('ver-aviso');
    clearTimeout(aviso.temporizador);
    aviso.temporizador = setTimeout(function () {
        aviso.classList.remove('ver-aviso');
    }, 2800);
}

// trae las declaraciones guardadas, si algo falla devuelve lista vacia
function leerDeclaraciones() {
    return leerLista(K.declaraciones);
}

// guarda la lista completa en localStorage
function guardarDeclaraciones(lista) {
    return guardarLista(K.declaraciones, lista);
}

// busca una declaracion guardada por su id
function buscarRegistro(id) {
    return porId(leerDeclaraciones(), id) || null;
}

// fecha de hoy como dd/mm/yyyy
function fechaHoy() {
    return new Date().toLocaleDateString('en-GB');   // dd/mm/yyyy
}

// cambia & < > y comillas para que el texto no rompa el html
function escaparHTML(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// crea el archivo en memoria y lo baja con un link falso
function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo || 'text/plain' });
    var enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

// devuelve el fondo oscuro de las ventanas (lo crea la primera vez)
function fondoModal() {
    var fondo = $('modalFondo');
    if (!fondo) {
        fondo = document.createElement('div');
        fondo.id = 'modalFondo';
        fondo.className = 'modal-fondo';
        // clic en la parte oscura la cierra
        fondo.onclick = function (e) { if (e.target == fondo) cerrarModal(); };
        document.body.appendChild(fondo);
    }
    return fondo;
}

// abre la ventana emergente con el html que le pasen
function abrirModal(html) {
    var fondo = fondoModal();
    fondo.innerHTML = html;
    fondo.classList.add('visible');
}

function cerrarModal() {
    fondoModal().classList.remove('visible');
}

// ventana de detalle: titulo y filas [etiqueta, valor]
function mostrarVentana(titulo, filas) {
    var html = '<div class="modal"><h2>' + escaparHTML(titulo) + '</h2><table>';
    filas.forEach(function (f) {
        html += '<tr><td>' + escaparHTML(f[0]) + '</td><td>' + escaparHTML(f[1] || '-') + '</td></tr>';
    });
    abrirModal(html + '</table><div class="botones"><button id="btnCerrarVentana">Cerrar</button></div></div>');
    $('btnCerrarVentana').onclick = cerrarModal;
}

// ventana para cambiar la contraseña del usuario que esta dentro
function cambiarClave() {
    abrirModal('<div class="modal"><h2>Cambiar contraseña</h2>' +
        '<label>Contraseña actual</label><input type="password" id="claveActual">' +
        '<label style="margin-top:10px">Contraseña nueva (mínimo 6 caracteres)</label><input type="password" id="claveNueva">' +
        '<label style="margin-top:10px">Repetir contraseña nueva</label><input type="password" id="claveRepetida">' +
        '<p id="errorClave" class="error-texto"></p>' +
        '<div class="botones"><button id="btnGuardarClave">Guardar</button>' +
        '<button class="volver" id="btnCancelarClave">Cancelar</button></div></div>');

    $('btnCancelarClave').onclick = cerrarModal;
    $('btnGuardarClave').onclick = function () {
        var actual = $('claveActual').value;
        var nueva = $('claveNueva').value;
        var error = $('errorClave');
        var lista = leerLista(K.usuarios);
        var u = porId(lista, sesionActual().id);

        if (!u || u.claveHash != hashClave(actual)) { error.textContent = 'La contraseña actual no es correcta'; return; }
        if (nueva.length < 6 || nueva.length > 64) { error.textContent = 'La contraseña debe tener entre 6 y 64 caracteres'; return; }
        if (nueva == actual) { error.textContent = 'La nueva contraseña debe ser distinta a la actual'; return; }
        if (nueva != $('claveRepetida').value) { error.textContent = 'Las contraseñas nuevas no coinciden'; return; }

        u.claveHash = hashClave(nueva);
        guardarLista(K.usuarios, lista);
        cerrarModal();
        mostrarAviso('Contraseña actualizada');
    };
}

// de dd/mm/yyyy a yyyy-mm-dd para poder comparar fechas
function convertirFecha(texto) {
    var p = texto.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
}

// suma 1 al contador de recibos generados
function sumarRecibo() {
    localStorage.setItem(K.recibos, leerRecibos() + 1);
}

// ---------- al cargar la pagina ----------

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso) return;   // ya lo mando al login

    var pagina = document.body.getAttribute('data-pagina');
    if (pagina == 'login') return;  // el login no lleva menu (lo maneja inicio.js)

    dibujarMenu();
    pintarIconos();    // iconos que estan escritos en el html como <i data-ico>
    prepararMovil();

    if (pagina == 'nueva') iniciarNueva();
    if (pagina == 'buscar') iniciarBusqueda();
    if (pagina == 'inicio') iniciarInicio();

    etiquetarTablas();
});

// SmartCustoms NI - datos, sesion y permisos
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
    configuracion: ['administrador']
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

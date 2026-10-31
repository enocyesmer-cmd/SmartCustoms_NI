// SmartCustoms NI - datos, sesion y permisos


var K = {
    usuarios: 'sc_usuarios',
    clientes: 'sc_clientes',
    productos: 'sc_productos',
    config: 'sc_config',
    xml: 'sc_xml_generados',
    declaraciones: 'smartcustoms_declaraciones',
    sesion: 'sc_sesion'
};

var ROLES = ['declarante', 'revisor', 'administrador'];

// que roles pueden entrar a cada pagina
var PERMISOS = {
    inicio: ['declarante', 'revisor', 'administrador'],
    nueva: ['declarante', 'administrador'],
    buscar: ['declarante', 'revisor', 'administrador'],
    clientes: ['declarante', 'revisor', 'administrador'],
    productos: ['declarante', 'revisor', 'administrador'],
    reportes: ['revisor', 'administrador'],
    configuracion: ['administrador']
};



function leerLista(clave) {
    try {
        return JSON.parse(localStorage.getItem(clave)) || [];
    } catch (e) {
        return [];
    }
}

function guardarLista(clave, lista) {
    localStorage.setItem(clave, JSON.stringify(lista));
}

function leerConfig() {
    try {
        return JSON.parse(localStorage.getItem(K.config)) || {};
    } catch (e) {
        return {};
    }
}

function guardarConfig(obj) {
    localStorage.setItem(K.config, JSON.stringify(obj));
}

function nuevoId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}



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
        lista.push({
            id: nuevoId(),
            usuario: 'admin',
            nombre: 'Administrador',
            rol: 'administrador',
            claveHash: hashClave('admin123'),
            activo: true
        });
        guardarLista(K.usuarios, lista);
    }
}



function sesionActual() {
    try {
        return JSON.parse(sessionStorage.getItem(K.sesion));
    } catch (e) {
        return null;
    }
}

// devuelve texto de error, o '' si entro bien
function iniciarSesion(usuario, clave) {
    var lista = leerLista(K.usuarios);
    for (var i = 0; i < lista.length; i++) {
        var u = lista[i];
        if (u.usuario.toLowerCase() == usuario.toLowerCase()) {
            if (u.claveHash != hashClave(clave)) return 'Usuario o contraseña incorrectos';
            if (!u.activo) return 'Este usuario está desactivado';
            sessionStorage.setItem(K.sesion, JSON.stringify({
                id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol
            }));
            return '';
        }
    }
    return 'Usuario o contraseña incorrectos';
}

function cerrarSesion() {
    sessionStorage.removeItem(K.sesion);
    window.location.href = 'login.html';
}

function puedeVerPagina(pagina, rol) {
    var roles = PERMISOS[pagina];
    return roles ? roles.indexOf(rol) != -1 : false;
}

// revisor solo consulta clientes y productos
function puedeModificarCatalogos(rol) {
    return rol == 'declarante' || rol == 'administrador';
}

// se ejecuta al cargar cada pagina
function protegerPagina() {
    var pagina = document.body.getAttribute('data-pagina');
    crearUsuarioInicial();
    if (pagina == 'login') return;

    var s = sesionActual();
    if (!s) {
        window.sinAcceso = true;
        window.location.replace('login.html');
        return;
    }
    // el usuario pudo ser borrado o desactivado
    var lista = leerLista(K.usuarios);
    var existe = false;
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == s.id && lista[i].activo) {
            existe = true;
            s.rol = lista[i].rol;     // por si le cambiaron el rol
            s.nombre = lista[i].nombre;
            sessionStorage.setItem(K.sesion, JSON.stringify(s));
        }
    }
    if (!existe) {
        sessionStorage.removeItem(K.sesion);
        window.sinAcceso = true;
        window.location.replace('login.html');
        return;
    }
    if (!puedeVerPagina(pagina, s.rol)) {
        window.sinAcceso = true;
        window.location.replace('index.html?sinpermiso=1');
    }
}

protegerPagina();

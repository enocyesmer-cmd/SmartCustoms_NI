// SmartCustoms NI - conexion con la base de datos (SQLite)
// Se carga ANTES que datos.js en todas las paginas.
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

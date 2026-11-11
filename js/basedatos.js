// SmartCustoms NI - tarjeta "Base de datos" de Configuracion
// Muestra si la web esta conectada a SQLite y cuantos registros hay en cada tabla.

document.addEventListener('DOMContentLoaded', function () {
    if (window.sinAcceso || !$('tarjetaBD')) return;

    if (!window.SC_DB || SC_DB.modo != 'servidor') {
        $('bdTexto').textContent = 'Modo local: los datos se guardan solo en este navegador. ' +
            'Para guardarlos en una base de datos SQLite y compartirlos entre equipos, publique la web con el servidor (ver README.md).';
        $('bdTablas').style.display = 'none';
        return;
    }

    fetch('api/estado').then(function (r) { return r.json(); }).then(function (e) {
        var kb = Math.max(1, Math.round(e.tamano / 1024));
        $('bdTexto').textContent = 'Conectada a ' + e.motor + ' (' + e.archivo + ', ' + kb + ' KB).';
        var nombres = { usuarios: 'Usuarios', clientes: 'Clientes', productos: 'Productos', declaraciones: 'Declaraciones' };
        var html = '';
        Object.keys(e.tablas).forEach(function (t) {
            html += '<div class="card"><h2>' + e.tablas[t] + '</h2><p>' + (nombres[t] || t) + '</p></div>';
        });
        $('bdTablas').innerHTML = html;
        $('bdBotones').style.display = '';
        $('bdNota').textContent = 'La copia .db se puede abrir con DB Browser for SQLite. Guárdela en un lugar seguro: contiene los datos de todos los usuarios.';
    }).catch(function () {
        $('bdTexto').textContent = 'No se pudo consultar la base de datos en este momento.';
    });
});

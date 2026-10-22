/**
 * Vista de ajustes: fuentes, reproduccion, contenido, apariencia y datos.
 * Todas las acciones se pueden completar con el mando; los campos de texto
 * usan el teclado en pantalla del televisor.
 */

import { el, clear } from '../../core/dom.js';
import { createList } from '../components/list.js';
import { createDialog } from '../components/dialog.js';
import { hashPin } from '../../core/storage.js';

function section(title) {
  var node = el('section', { class: 'settings__section' });
  node.appendChild(el('h2', { class: 'settings__title', text: title }));
  return node;
}

function row(label, valueText, options) {
  var opts = options || {};
  var node = el('div', {
    class: 'settings__row',
    'data-focusable': 'true',
    'data-nav-scope': 'content',
    tabindex: '-1',
    role: 'button'
  });
  var body = el('div', { class: 'settings__rowbody' });
  body.appendChild(el('span', { class: 'settings__label', text: label }));
  if (valueText !== undefined && valueText !== null && valueText !== '') {
    body.appendChild(el('span', { class: 'settings__value', text: valueText }));
  }
  node.appendChild(body);
  if (opts.onSelect) {
    node.addEventListener('click', function () { opts.onSelect(node); });
  }
  return node;
}

export function createSettingsView(ctx) {
  var element = el('section', { class: 'view view--settings' });
  var header = el('header', { class: 'view__header' });
  header.appendChild(el('h1', { class: 'view__title', text: 'Ajustes' }));
  element.appendChild(header);
  var body = el('div', { class: 'view__body view__body--rows' });
  element.appendChild(body);

  var confirmDialog = createDialog({
    title: 'Confirmar',
    message: '',
    actions: []
  });
  element.appendChild(confirmDialog.element);

  var formDialog = createDialog({
    title: 'Anadir fuente',
    actions: [
      { label: 'Guardar', primary: true },
      { label: 'Cancelar' }
    ]
  });
  element.appendChild(formDialog.element);

  var pinInput = el('input', { class: 'field', type: 'password', inputmode: 'numeric', placeholder: 'PIN de 4 digitos', 'data-focusable': 'true' });
  var pinDialog = createDialog({
    title: 'Activar control parental',
    body: pinInput,
    actions: [
      { label: 'Activar', primary: true },
      { label: 'Cancelar' }
    ]
  });
  element.appendChild(pinDialog.element);

  function prefs() {
    return ctx.storage.getPrefs();
  }

  function askConfirm(title, message, onConfirm) {
    confirmDialog.setActions([
      { label: 'Si', primary: true, onSelect: onConfirm },
      { label: 'No' }
    ]);
    confirmDialog.open();
    formDialog.close();
  }

  function cycle(key, values, labels) {
    var current = prefs()[key];
    var index = values.indexOf(current);
    index = (index + 1) % values.length;
    ctx.storage.setPrefs(pick(key, values[index]));
    ctx.toaster.show(labels ? (labels[index] || values[index]) : values[index]);
    show();
  }

  function pick(key, value) {
    var patch = {};
    patch[key] = value;
    return patch;
  }

  /**
   * Carga la fuente activa y avisa al usuario del resultado. Sin esto la
   * lista se queda vacia hasta reiniciar la aplicacion.
   */
  function loadActiveSource() {
    return ctx.sources.loadChannels({ force: true }).then(function (result) {
      var count = result.channels.length;
      if (count) {
        ctx.toaster.show('Canales cargados: ' + count);
      } else {
        ctx.toaster.show('La lista se descargo pero no tiene canales');
      }
      show();
      return result;
    }).catch(function (err) {
      ctx.toaster.show(err && err.message ? err.message : 'No se pudo cargar la fuente', 'error');
      show();
      throw err;
    });
  }

  function openSourceForm() {
    var name = el('input', { class: 'field', type: 'text', placeholder: 'Nombre', value: '', 'data-focusable': 'true' });
    var type = el('select', { class: 'field', 'data-focusable': 'true' });
    var optM3u = el('option', { value: 'm3u', text: 'Lista M3U / M3U8 (URL)' });
    var optXtream = el('option', { value: 'xtream', text: 'Xtream Codes' });
    type.appendChild(optM3u);
    type.appendChild(optXtream);
    var url = el('input', { class: 'field', type: 'url', placeholder: 'http://servidor/plista.m3u', 'data-focusable': 'true' });
    var user = el('input', { class: 'field', type: 'text', placeholder: 'Usuario (Xtream)', 'data-focusable': 'true' });
    var pass = el('input', { class: 'field', type: 'password', placeholder: 'Contrasena (Xtream)', 'data-focusable': 'true' });
    var epg = el('input', { class: 'field', type: 'url', placeholder: 'URL de la guia XMLTV (opcional)', 'data-focusable': 'true' });

    var form = el('div', { class: 'form' });
    function addField(labelText, input) {
      var label = el('span', { class: 'form__label', text: labelText });
      var wrap = el('label', { class: 'form__row' });
      wrap.appendChild(label);
      wrap.appendChild(input);
      form.appendChild(wrap);
      return label;
    }
    var urlLabel;
    addField('Nombre', name);
    addField('Tipo', type);
    urlLabel = addField('URL', url);
    addField('Usuario (Xtream)', user);
    addField('Contrasena (Xtream)', pass);
    addField('Guia XMLTV (opcional)', epg);

    // En Xtream el campo de URL es la direccion del servidor.
    type.addEventListener('change', function () {
      urlLabel.textContent = type.value === 'xtream' ? 'Servidor' : 'URL';
    });

    // El formulario se adjunta al dialogo: sin esto el dialogo se abriria
    // vacio, sin ningun campo.
    formDialog.setBody(form);
    formDialog.setActions([
      {
        label: 'Guardar',
        primary: true,
        onSelect: function () {
          var config = {
            name: name.value,
            type: type.value,
            url: type.value === 'xtream' ? url.value : url.value,
            baseUrl: url.value,
            username: user.value,
            password: pass.value,
            epgUrl: epg.value
          };
          try {
            var record = ctx.sources.addSource(config);
            ctx.toaster.show('Fuente anadida');
            show();
            // Si la fuente nueva queda activa, se carga de inmediato para no
            // dejar la lista de canales vacia.
            var active = ctx.sources.getActiveSource();
            if (active && active.id === record.id) {
              loadActiveSource();
            }
            return false;
          } catch (err) {
            ctx.toaster.show(err && err.message ? err.message : 'No se pudo anadir la fuente', 'error');
            return false;
          }
        }
      },
      { label: 'Cancelar' }
    ]);
    formDialog.open();
    setTimeout(function () { try { name.focus(); } catch (e) { /* ignorado */ } }, 50);
  }

  function show() {
    clear(body);
    var p = prefs();

    var sourcesSection = section('Fuentes');
    var sources = ctx.sources.listSources();
    if (!sources.length) {
      sourcesSection.appendChild(el('p', { class: 'empty', text: 'No hay fuentes configuradas.' }));
    } else {
      var list = createList(sources, {
        scope: 'content',
        onSelect: function (source) {
          var actions = [
            { label: source.active ? 'Fuente activa' : 'Activar', primary: !source.active, onSelect: function () {
              ctx.sources.activate(source.id);
              ctx.toaster.show('Fuente activada: ' + source.name);
              show();
              // Activar una fuente descarga su lista ahora mismo.
              loadActiveSource();
            } },
            { label: 'Quitar', onSelect: function () {
              askConfirm('Quitar fuente', 'Se eliminara "' + source.name + '" y sus credenciales.', function () {
                ctx.sources.removeSource(source.id);
                ctx.toaster.show('Fuente eliminada');
                show();
              });
            } }
          ];
          confirmDialog.setActions(actions);
          confirmDialog.open();
        },
        subtitleFor: function (source) {
          return (source.type === 'xtream' ? 'Xtream Codes' : 'M3U') + (source.active ? ' - activa' : '');
        }
      });
      sourcesSection.appendChild(list);
    }
    sourcesSection.appendChild(row('Anadir fuente', '', { onSelect: openSourceForm }));
    body.appendChild(sourcesSection);

    var playback = section('Reproduccion');
    playback.appendChild(row('Motor de reproduccion', p.playerMode === 'mse' ? 'MSE (Shaka)' : 'Nativo (HLS)', {
      onSelect: function () { cycle('playerMode', ['native', 'mse'], ['Nativo (HLS)', 'MSE (Shaka)']); }
    }));
    playback.appendChild(row('Reanudar el ultimo canal', p.startOnLastChannel ? 'Si' : 'No', {
      onSelect: function () { cycle('startOnLastChannel', [true, false], ['Si', 'No']); }
    }));
    playback.appendChild(row('Mostrar canales ocultos', p.showHiddenChannels ? 'Si' : 'No', {
      onSelect: function () { cycle('showHiddenChannels', [true, false], ['Si', 'No']); }
    }));
    body.appendChild(playback);

    var content = section('Contenido');
    content.appendChild(row('Control parental', p.parentalEnabled ? 'Activado' : 'Desactivado', {
      onSelect: function () {
        if (p.parentalEnabled) {
          ctx.storage.setPrefs(pick('parentalEnabled', false));
          show();
          return;
        }
        pinDialog.setActions([
          {
            label: 'Activar', primary: true, onSelect: function () {
              if (!/^\d{4}$/.test(pinInput.value)) {
                ctx.toaster.show('El PIN debe tener 4 digitos', 'error');
                return false;
              }
              ctx.storage.setPrefs({ parentalEnabled: true, parentalPin: hashPin(pinInput.value) });
              ctx.toaster.show('Control parental activado');
              show();
            }
          },
          { label: 'Cancelar' }
        ]);
        pinInput.value = '';
        pinDialog.open();
      }
    }));
    body.appendChild(content);

    var appearance = section('Apariencia');
    appearance.appendChild(row('Tema', p.theme, {
      onSelect: function () { cycle('theme', ['midnight', 'dark', 'light'], ['midnight', 'dark', 'light']); }
    }));
    appearance.appendChild(row('Tamano del texto', p.textScale, {
      onSelect: function () { cycle('textScale', ['small', 'medium', 'large'], ['small', 'medium', 'large']); }
    }));
    appearance.appendChild(row('Animaciones', p.animations, {
      onSelect: function () { cycle('animations', ['full', 'reduced', 'none'], ['full', 'reduced', 'none']); }
    }));
    body.appendChild(appearance);

    var data = section('Datos');
    data.appendChild(row('Borrar historial', '', {
      onSelect: function () {
        askConfirm('Borrar historial', 'Se eliminara el historial de reproduccion.', function () {
          ctx.storage.clearHistory();
          ctx.toaster.show('Historial borrado');
        });
      }
    }));
    data.appendChild(row('Borrar todos los datos', '', {
      onSelect: function () {
        askConfirm('Borrar todo', 'Se eliminaran fuentes, favoritos, historial y ajustes.', function () {
          ctx.storage.clearAll();
          ctx.toaster.show('Datos borrados');
          show();
        });
      }
    }));
    body.appendChild(data);

    ctx.focusFirstIn(['content']);
  }

  return {
    element: element,
    show: show,
    handleKey: function (event) {
      if (confirmDialog.isOpen()) return confirmDialog.handleKey(event);
      if (formDialog.isOpen()) return formDialog.handleKey(event);
      return false;
    }
  };
}

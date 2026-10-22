/**
 * Capa de reproduccion a pantalla completa con overlays de informacion.
 * El <video> vive aqui; el resto de la app queda detras.
 */

import { el, clear } from '../../core/dom.js';
import { KEY } from '../../config.js';

export function createPlayerOverlay(options) {
  var opts = options || {};
  var video = opts.video || el('video', { class: 'player__video', playsinline: '', 'webkit-playsinline': '' });
  video.classList.add('player__video');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x-webkit-airplay', 'deny');

  var root = el('div', { class: 'player', 'data-hidden': 'true' });
  root.appendChild(video);

  var backdrop = el('div', { class: 'player__backdrop', 'data-hidden': 'true' });
  root.appendChild(backdrop);

  var info = el('div', { class: 'player__info', 'data-hidden': 'true' });
  var infoTitle = el('h1', { class: 'player__title', text: '' });
  var infoProgram = el('p', { class: 'player__program', text: '' });
  var infoExtra = el('p', { class: 'player__extra', text: '' });
  info.appendChild(infoTitle);
  info.appendChild(infoProgram);
  info.appendChild(infoExtra);
  root.appendChild(info);

  var bar = el('div', { class: 'player__bar', 'data-hidden': 'true' });
  var status = el('span', { class: 'player__status', text: '' });
  bar.appendChild(status);
  var volume = el('span', { class: 'player__volume', text: '' });
  bar.appendChild(volume);
  root.appendChild(bar);

  var visible = false;
  var overlayTimer = null;
  var onExit = opts.onExit || function () {};

  function showOverlay() {
    backdrop.setAttribute('data-hidden', 'false');
    info.setAttribute('data-hidden', 'false');
    bar.setAttribute('data-hidden', 'false');
    visible = true;
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(hideOverlay, 6000);
  }

  function hideOverlay() {
    backdrop.setAttribute('data-hidden', 'true');
    info.setAttribute('data-hidden', 'true');
    bar.setAttribute('data-hidden', 'true');
    visible = false;
    if (overlayTimer) clearTimeout(overlayTimer);
  }

  function setItem(item, programme) {
    infoTitle.textContent = item ? item.name : '';
    infoProgram.textContent = programme ? (programme.title + (programme.start ? ' - ' + programme.start : '')) : '';
    infoExtra.textContent = item && item.group ? item.group : '';
  }

  function setStatus(text) {
    status.textContent = text || '';
  }

  function setVolumeLabel(value) {
    volume.textContent = 'Vol ' + Math.round(value * 100) + '%';
  }

  function open(item) {
    root.setAttribute('data-hidden', 'false');
    root.classList.add('is-open');
    setItem(item);
    showOverlay();
  }

  function close() {
    root.setAttribute('data-hidden', 'true');
    root.classList.remove('is-open');
    hideOverlay();
  }

  /**
   * Gestiona las teclas del mando mientras el reproductor esta abierto.
   * @returns {boolean} true si la tecla se ha consumido.
   */
  function handleKey(event) {
    var code = event.keyCode;
    switch (code) {
      case KEY.ENTER:
      case KEY.PLAY:
        if (opts.onTogglePlay) opts.onTogglePlay();
        showOverlay();
        return true;
      case KEY.PAUSE:
        if (opts.onPause) opts.onPause();
        showOverlay();
        return true;
      case KEY.LEFT:
      case KEY.RIGHT: {
        var delta = code === KEY.RIGHT ? 0.05 : -0.05;
        var current = opts.getVolume ? opts.getVolume() : 1;
        var next = Math.max(0, Math.min(1, current + delta));
        if (opts.onVolume) opts.onVolume(next);
        setVolumeLabel(next);
        showOverlay();
        return true;
      }
      case KEY.INFO:
        if (visible) hideOverlay(); else showOverlay();
        return true;
      case KEY.BACK:
      case KEY.ESCAPE:
      case KEY.EXIT:
      case KEY.RED:
        onExit();
        return true;
      default:
        return false;
    }
  }

  return {
    element: root,
    video: video,
    open: open,
    close: close,
    setItem: setItem,
    setStatus: setStatus,
    setVolumeLabel: setVolumeLabel,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay,
    handleKey: handleKey,
    isOpen: function () { return root.getAttribute('data-hidden') === 'false'; }
  };
}

/**
 * Vista de canales: selector de grupo + lista (o rejilla) de canales.
 */

import { el, clear } from '../../core/dom.js';
import { createList } from '../components/list.js';
import { createRow } from '../components/row.js';
import { createCard } from '../components/card.js';
import { KEY } from '../../config.js';

export function createChannelsView(ctx) {
  var element = el('section', { class: 'view view--channels' });
  var header = el('header', { class: 'view__header' });
  var title = el('h1', { class: 'view__title', text: 'Canales' });
  var count = el('span', { class: 'view__count', text: '' });
  header.appendChild(title);
  header.appendChild(count);
  element.appendChild(header);

  var groupBar = el('div', { class: 'groupbar' });
  element.appendChild(groupBar);

  var body = el('div', { class: 'view__body' });
  element.appendChild(body);

  var layout = 'list';
  var groups = [];
  var activeGroup = 'Todos';
  var channels = [];
  var listNode = null;

  function renderGroups() {
    clear(groupBar);
    groups.forEach(function (group) {
      var chip = el('button', {
        class: 'chip' + (group === activeGroup ? ' is-active' : ''),
        'data-focusable': 'true',
        'data-nav-scope': 'groups',
        type: 'button',
        text: group
      });
      chip.addEventListener('click', function () {
        activeGroup = group;
        renderGroups();
        renderChannels();
      });
      groupBar.appendChild(chip);
    });
  }

  function visibleChannels() {
    if (activeGroup === 'Todos') return channels;
    return channels.filter(function (channel) { return channel.group === activeGroup; });
  }

  function renderChannels() {
    clear(body);
    var items = visibleChannels();
    count.textContent = items.length + (items.length === 1 ? ' canal' : ' canales');
    if (!items.length) {
      body.appendChild(el('p', { class: 'empty', text: 'No hay canales para esta fuente.' }));
      return;
    }
    if (layout === 'grid') {
      var track = el('div', { class: 'grid' });
      items.forEach(function (item) {
        track.appendChild(createCard(item, { onSelect: play, scope: 'content' }));
      });
      body.appendChild(track);
    } else {
      listNode = createList(items, {
        onSelect: play,
        scope: 'content',
        subtitleFor: function (item) {
          var programme = ctx.epg.current(item);
          return programme ? programme.title : (item.group || '');
        },
        trailing: function (item) {
          var badge = el('span', { class: 'list__tag', text: item.kind === 'vod' ? 'VOD' : '' });
          return badge.textContent ? badge : null;
        }
      });
      body.appendChild(listNode);
    }
  }

  function play(item) {
    ctx.play(item);
  }

  function show(params) {
    var query = (params && params.query) || {};
    activeGroup = query.group || 'Todos';
    var state = ctx.sources.getState();
    channels = state.channels || [];
    groups = ['Todos'].concat(state.groups || []);
    renderGroups();
    renderChannels();
    ctx.focusFirstIn(['groups', 'content']);
  }

  return {
    element: element,
    show: show,
    handleKey: function (event) {
      if (event.keyCode === KEY.INFO) {
        layout = layout === 'list' ? 'grid' : 'list';
        renderChannels();
        return true;
      }
      return false;
    },
    setChannels: function (list) {
      channels = list || [];
    }
  };
}

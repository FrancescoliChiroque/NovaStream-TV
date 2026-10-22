/**
 * Vistas de peliculas y series.
 * Las peliculas provienen de entradas VOD de la lista o del catalogo
 * Xtream; las series solo existen en fuentes Xtream Codes.
 */

import { el, clear } from '../../core/dom.js';
import { createCard } from '../components/card.js';
import { createRow } from '../components/row.js';

export function createMoviesView(ctx) {
  var element = el('section', { class: 'view view--movies' });
  var header = el('header', { class: 'view__header' });
  var title = el('h1', { class: 'view__title', text: 'Peliculas' });
  var count = el('span', { class: 'view__count', text: '' });
  header.appendChild(title);
  header.appendChild(count);
  element.appendChild(header);
  var body = el('div', { class: 'view__body view__body--rows' });
  element.appendChild(body);

  var movies = [];

  function show() {
    clear(body);
    var source = ctx.sources.getActiveSource();
    ctx.catalog.loadMovies(source).then(function (list) {
      movies = list || [];
      count.textContent = movies.length + (movies.length === 1 ? ' pelicula' : ' peliculas');
      if (!movies.length) {
        body.appendChild(el('p', { class: 'empty', text: 'No hay peliculas disponibles en la fuente actual.' }));
        ctx.focusFirstIn(['content']);
        return;
      }
      var groups = Object.create(null);
      movies.forEach(function (movie) {
        var key = movie.group || 'Otros';
        if (!groups[key]) groups[key] = [];
        groups[key].push(movie);
      });
      Object.keys(groups).forEach(function (group) {
        body.appendChild(createRow(group, groups[group], {
          onSelect: function (item) { ctx.play(item); },
          subtitleFor: function (item) { return item.year || ''; },
          wide: true
        }));
      });
      ctx.focusFirstIn(['content']);
    }).catch(function (err) {
      body.appendChild(el('p', { class: 'empty', text: 'No se pudo cargar el catalogo: ' + (err && err.message ? err.message : 'error') }));
    });
  }

  return { element: element, show: show };
}

export function createSeriesView(ctx) {
  var element = el('section', { class: 'view view--series' });
  var header = el('header', { class: 'view__header' });
  var title = el('h1', { class: 'view__title', text: 'Series' });
  var count = el('span', { class: 'view__count', text: '' });
  header.appendChild(title);
  header.appendChild(count);
  element.appendChild(header);
  var body = el('div', { class: 'view__body view__body--rows' });
  element.appendChild(body);

  function show() {
    clear(body);
    var source = ctx.sources.getActiveSource();
    if (!source || source.type !== 'xtream') {
      body.appendChild(el('p', { class: 'empty', text: 'Las series requieren una fuente Xtream Codes.' }));
      ctx.focusFirstIn(['content']);
      return;
    }
    ctx.catalog.loadSeries(source).then(function (list) {
      count.textContent = list.length + (list.length === 1 ? ' serie' : ' series');
      if (!list.length) {
        body.appendChild(el('p', { class: 'empty', text: 'No hay series disponibles.' }));
        ctx.focusFirstIn(['content']);
        return;
      }
      var groups = Object.create(null);
      list.forEach(function (item) {
        var key = item.group || 'Series';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      Object.keys(groups).forEach(function (group) {
        body.appendChild(createRow(group, groups[group], {
          onSelect: function (item) { ctx.router.navigate('/series/' + encodeURIComponent(item.id)); },
          subtitleFor: function (item) { return item.year || ''; },
          wide: true
        }));
      });
      ctx.focusFirstIn(['content']);
    }).catch(function (err) {
      body.appendChild(el('p', { class: 'empty', text: 'No se pudo cargar el catalogo: ' + (err && err.message ? err.message : 'error') }));
    });
  }

  return { element: element, show: show };
}

/** Detalle de serie: capitulos. */
export function createSeriesDetailView(ctx) {
  var element = el('section', { class: 'view view--series-detail' });
  var header = el('header', { class: 'view__header' });
  var title = el('h1', { class: 'view__title', text: 'Serie' });
  var count = el('span', { class: 'view__count', text: '' });
  header.appendChild(title);
  header.appendChild(count);
  element.appendChild(header);
  var body = el('div', { class: 'view__body' });
  element.appendChild(body);

  function show(params) {
    clear(body);
    var source = ctx.sources.getActiveSource();
    var seriesItem = ctx.findSeriesById(params.id);
    title.textContent = seriesItem ? seriesItem.name : 'Serie';
    if (!seriesItem) {
      body.appendChild(el('p', { class: 'empty', text: 'No se encuentra la serie seleccionada.' }));
      return;
    }
    ctx.catalog.loadEpisodes(source, seriesItem).then(function (episodes) {
      count.textContent = episodes.length + (episodes.length === 1 ? ' capitulo' : ' capitulos');
      var list = el('div', { class: 'episodes' });
      episodes.forEach(function (episode) {
        var card = createCard(episode, {
          onSelect: function (item) { ctx.play(item); },
          subtitle: episode.season + 'x' + episode.number,
          scope: 'content'
        });
        list.appendChild(card);
      });
      body.appendChild(list);
      ctx.focusFirstIn(['content']);
    }).catch(function (err) {
      body.appendChild(el('p', { class: 'empty', text: 'No se pudieron cargar los capitulos: ' + (err && err.message ? err.message : 'error') }));
    });
  }

  return { element: element, show: show };
}

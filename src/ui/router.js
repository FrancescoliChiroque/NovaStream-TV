/**
 * Enrutador sencillo basado en hash.
 * Rutas: #/home, #/channels, #/movies, #/series, #/series/:id, #/search,
 *        #/settings, #/diagnostics, #/favorites.
 */

export function createRouter(bus) {
  var routes = Object.create(null);
  var current = { path: '', params: {} };
  var notFound = null;

  function parse(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw || raw === '/') raw = '/home';
    var query = {};
    var queryIndex = raw.indexOf('?');
    if (queryIndex >= 0) {
      var queryString = raw.slice(queryIndex + 1);
      raw = raw.slice(0, queryIndex);
      queryString.split('&').forEach(function (pair) {
        if (!pair) return;
        var parts = pair.split('=');
        query[decodeURIComponent(parts[0])] = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
      });
    }
    var parts = raw.split('/').filter(function (part) { return part.length > 0; });
    var path = '/' + (parts.length ? parts[0] : 'home');
    var params = { query: query };
    if (parts.length > 1) {
      params.id = decodeURIComponent(parts[1]);
      params.rest = parts.slice(2);
    }
    return { path: path, params: params };
  }

  function register(path, handler) {
    routes[path] = handler;
    return router;
  }

  function resolve() {
    var target = parse(globalThis.location.hash);
    var handler = routes[target.path];
    current = target;
    if (!handler) {
      if (notFound) notFound(target);
      return;
    }
    Promise.resolve(handler(target.params, target)).catch(function (err) {
      bus.emit('route:error', { path: target.path, error: err });
    });
  }

  function navigate(path) {
    var next = path.charAt(0) === '#' ? path : '#' + path;
    if (globalThis.location.hash === next) {
      resolve();
      return;
    }
    globalThis.location.hash = next;
  }

  function start() {
    globalThis.addEventListener('hashchange', resolve);
    resolve();
  }

  var router = {
    register: register,
    navigate: navigate,
    start: start,
    resolve: resolve,
    getCurrent: function () { return current; },
    setNotFound: function (handler) { notFound = handler; }
  };
  return router;
}

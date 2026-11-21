// Read-only snapshot shim (GitHub Pages build only). Serves /api GETs from saved JSON; mutating calls are no-ops.
(function () {
  var MAP = { '/api/state': 'api/state.json', '/api/digest': 'api/digest.json', '/api/track-record': 'api/track-record.json' };
  var MSG = 'Read-only snapshot. Approvals work in the live app.';
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, opts) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((opts && opts.method) || 'GET').toUpperCase();
    if (url.indexOf('/api/') !== 0) return realFetch(input, opts);
    var p = url.split('?')[0];
    if (method === 'GET' && MAP[p]) return realFetch(MAP[p], { cache: 'no-cache' });
    return Promise.resolve(new Response(JSON.stringify({ error: MSG, code: 'read_only' }), { status: 403, headers: { 'content-type': 'application/json' } }));
  };
  function banner() {
    var b = document.createElement('div');
    b.id = 'snapshotBanner';
    b.setAttribute('style', 'position:sticky;top:0;z-index:50;background:#1e293b;color:#fde68a;border-bottom:1px solid #334155;padding:8px 14px;font:600 13px/1.4 system-ui,sans-serif;text-align:center');
    b.textContent = '📸 Read-only snapshot, updated Nov 21, 7:56 AM ET. Approvals work in the live app.';
    document.body.insertBefore(b, document.body.firstChild);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', banner) : banner();
})();

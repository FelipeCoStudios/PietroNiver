(() => {
async function run() {
  const b64 = (window.__G || []).join('');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bin]).stream().pipeThrough(ds);
  const s = await new Response(stream).text();
  (0, eval)(s);
}
const load = (i) => new Promise((res, rej) => {
  const sc = document.createElement('script');
  sc.src = 'gchunk' + i + '.js';
  sc.onload = res; sc.onerror = rej;
  document.head.appendChild(sc);
});
Promise.all([0,1,2].map(load)).then(run).catch(e => {
  console.error(e);
  document.body.innerHTML = '<h1 style="color:#FFD700;font-family:Arial;text-align:center;margin-top:40vh">Resenha Fut 9C edition</h1>';
});
})();

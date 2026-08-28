(() => {
const parts = [];
function loadNext(i) {
  if (i >= 2) {
    const s = atob(parts.join(''));
    (0, eval)(s);
    return;
  }
  const sc = document.createElement('script');
  sc.src = 'game-data-' + i + '.js';
  sc.onload = () => loadNext(i+1);
  document.head.appendChild(sc);
}
window.__pushGameB64 = (chunk) => parts.push(chunk);
loadNext(0);
})();

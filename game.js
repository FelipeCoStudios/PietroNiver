(() => {
async function run() {
  const bin = Uint8Array.from(atob("PLACEHOLDER_USE_FILE"), c => c.charCodeAt(0));
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bin]).stream().pipeThrough(ds);
  const s = await new Response(stream).text();
  (0, eval)(s);
}
run().catch(e => {
  console.error(e);
  document.body.innerHTML = "<h1 style=\"color:#FFD700;font-family:Arial;text-align:center;margin-top:40vh\">Resenha Fut 9C edition</h1>";
});
})();

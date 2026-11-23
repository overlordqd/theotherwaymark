// Landing page. The game itself will start here once the first playable slice exists;
// until then this only points the second button at a random valley of the showreel.
const link = document.querySelector<HTMLAnchorElement>('#random');
if (link) {
  const seed = 1000 + Math.floor(Math.random() * 9000);
  link.href = `showreel/#valley-${seed}`;
  link.textContent = `Watch valley ${seed}`;
}

const pilot = document.querySelector('.pilot');
const pilotHead = pilot.querySelector('.pilot-head');
document.querySelectorAll('h1 span').forEach((word,i) => word.style.setProperty('--word',i));
const hero = document.getElementById('hero');
const pilotArt = pilot.querySelector('.bot');
const pilotLook = {x: 0, y: 0};
const scrollPilot = matchMedia('(max-width: 660px), (pointer: coarse)');
let lastPilotScroll = Math.max(0, window.scrollY);
let scrollTravel = 0;
let settleTimer = 0;

function aimPilot(x, y) {
  pilotLook.x = x;
  pilotLook.y = y;
  pilotHead.style.transform = x || y
    ? 'perspective(750px) rotateY(' + x * 14 + 'deg) rotateX(' + (-y * 12) + 'deg) rotate(' + x * 2.6 + 'deg)'
    : '';
}
function resetPilot() {
  clearTimeout(settleTimer);
  scrollTravel = 0;
  lastPilotScroll = Math.max(0, window.scrollY);
  aimPilot(0, 0);
}
hero.addEventListener('pointermove', event => {
  if (scrollPilot.matches || event.pointerType === 'touch' || reduced.matches) return;
  const box = pilotArt.getBoundingClientRect();
  aimPilot(
    Math.tanh((event.clientX - box.left - box.width * .50) / (box.width * .58)),
    Math.tanh((event.clientY - box.top - box.height * .33) / (box.height * .48))
  );
}, {passive:true});
hero.addEventListener('pointerleave', () => {
  if (!scrollPilot.matches) resetPilot();
});
window.addEventListener('scroll', () => {
  const position = Math.max(0, window.scrollY);
  const delta = position - lastPilotScroll;
  lastPilotScroll = position;
  if (!delta || !scrollPilot.matches || reduced.matches) return;
  if (hero.getBoundingClientRect().bottom <= 0) return;
  if (Math.sign(delta) !== Math.sign(scrollTravel)) scrollTravel = 0;
  scrollTravel = Math.max(-110, Math.min(110, scrollTravel + delta));
  aimPilot(0, Math.tanh(scrollTravel / 48));
  clearTimeout(settleTimer);
  settleTimer = setTimeout(resetPilot, 300);
}, {passive:true});
window.addEventListener('blur', resetPilot);
scrollPilot.addEventListener('change', resetPilot);
reduced.addEventListener('change', resetPilot);
dialog.addEventListener('close',()=>{pilot.focus({preventScroll:true});});

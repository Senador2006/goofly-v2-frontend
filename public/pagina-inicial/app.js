const select = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const places = ["Maldivas","Paris","Bali"];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const sceneButtons = all('[data-scene]');
const scenePhotos = all('.scene');
const sceneDuration = 5000;
let scene = 0;
let sceneProgress;
let heroVisible = false;

function syncPlayback() {
  if (!sceneProgress) return;
  if (heroVisible && !document.hidden && !reduced.matches) sceneProgress.play();
  else sceneProgress.pause();
}

function showScene(index) {
  if (sceneProgress) {
    sceneProgress.onfinish = null;
    sceneProgress.cancel();
  }
  scene = (index + places.length) % places.length;
  scenePhotos.forEach((photo, i) => photo.classList.toggle('on', i === scene));
  sceneButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === scene)));
  select('#place').textContent = places[scene];
  const fill = sceneButtons[scene].firstElementChild;
  sceneProgress = fill.animate(
    [{transform:'scaleX(0)'}, {transform:'scaleX(1)'}],
    {duration:sceneDuration, easing:'linear', fill:'both'}
  );
  sceneProgress.onfinish = () => showScene(scene + 1);
  syncPlayback();
}
sceneButtons.forEach((button, i) => button.onclick = () => showScene(i));
select('[data-scene-prev]').onclick = () => showScene(scene - 1);
select('[data-scene-next]').onclick = () => showScene(scene + 1);
new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  syncPlayback();
}).observe(select('#hero'));
document.addEventListener('visibilitychange', syncPlayback);
reduced.addEventListener('change', () => showScene(scene));
showScene(0);

let review = 0;
function changeReview(delta) {
  const reviews = all('.review');
  review = (review + delta + reviews.length) % reviews.length;
  reviews.forEach((card, i) => card.hidden = i !== review);
}
select('[data-review-prev]').onclick = () => changeReview(-1);
select('[data-review-next]').onclick = () => changeReview(1);

const menuButton = select('.menu-toggle');
function toggleMenu(open) {
  select('#menu').classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? '×' : '☰';
}
menuButton.onclick = () => toggleMenu(menuButton.getAttribute('aria-expanded') !== 'true');
select('#menu').onclick = () => toggleMenu(false);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    toggleMenu(false); menuButton.focus();
  }
});


const steps = [{"title":"Conheça a Goofly","description":"Neste tour, você vai ver como escolher lugares para visitar e organizá-los em um roteiro."},{"title":"Comece pelo seu destino","description":"Use <strong>Começar meu roteiro</strong> para abrir o planejador. Se já tem cadastro, selecione <strong>Já tenho conta</strong>."},{"title":"Escolha para onde ir","description":"Os cartões de Maldivas, Paris e Bali abrem o planejador da Goofly."},{"title":"Veja os recursos em movimento","description":"Escolha um recurso para ver como organizar visitas, filtrar dicas, conferir ingressos ou mudar uma rota."},{"title":"Faça o teste com três lugares","description":"Escolha o destino e seu estilo de viagem. No Tinder de viagem, curta os lugares que você visitaria. Seu resumo reúne as paradas com horários sugeridos de chegada e saída."},{"title":"Comece a planejar grátis","description":"As duas opções abrem o cadastro. Você pode explorar destinos ou começar pelo lugar que já escolheu."},{"title":"Leia os relatos de viagem","description":"Use as setas para ler os relatos sobre as viagens a Portugal, Nova York e Tailândia."},{"title":"Fale com a Goofly","description":"Tem alguma dúvida sobre o planejamento? Escreva para <strong>goofly.team@gmail.com</strong> ou ligue para <strong>(11) 99993-7400</strong>."}];
const anchors = ['hero','hero','destinos','beneficios','como-funciona','planos','depoimentos','contato'];
const dialog = select('#tour');
let step = 0;
function showStep(index) {
  step = index;
  select('#progress').textContent = (step + 1) + ' de ' + steps.length;
  select('#tour-title').textContent = steps[step].title;
  select('#tour-copy').innerHTML = steps[step].description;
  select('#back').disabled = step === 0;
  select('#next').textContent = step === 0 ? 'Ver como funciona' : step === steps.length - 1 ? 'Criar conta grátis' : 'Próximo';
  document.getElementById(anchors[step]).scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
}
dialog.setAttribute('aria-labelledby','tour-title');
select('.pilot').onclick = () => {dialog.showModal();showStep(0);};
select('.close').onclick = () => dialog.close();
select('#back').onclick = () => showStep(step - 1);
select('#next').onclick = () => {
  if (step < steps.length - 1) showStep(step + 1);
  else window.top.location.assign('/register');
};
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});

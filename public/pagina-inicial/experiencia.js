(() => {
  const destinations = {
    Maldivas: [
      ['Ilha de Kuramathi','lugares/kuramathi.jpg'],['Malé','lugares/male.jpg'],['Hulhumalé','lugares/hulhumale.jpg']
    ],
    Paris: [
      ['Torre Eiffel','paris.jpg'],['Arco do Triunfo','lugares/arco.jpg'],['Jardim de Luxemburgo','lugares/luxemburgo.jpg']
    ],
    Bali: [
      ['Templo Ulun Danu Beratan','bali.jpg'],['Tanah Lot','lugares/tanah-lot.jpg'],['Templo de Uluwatu','lugares/uluwatu.jpg']
    ]
  };
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function animate(el,keyframes,options) {
    if(motion.matches || !el.animate) return null;
    return el.animate(keyframes,options);
  }
  const links = $$('.benefit-switch a');
  const diagrams = $$('.explain-scene');
  const panels = $$('.benefit-panel');
  const board = $('.motion-board');
  let active = 0;
  let interest = 0;
  const choices = Array.from(document.querySelectorAll('[data-interest]'));
  function move(el, frames, duration, delay = 0) {
    animate(el, frames, {duration, delay, fill:'backwards', easing:'cubic-bezier(.2,.74,.23,1)'});
  }
  function explain(change = false) {
    board.getAnimations({subtree:true}).forEach(a => a.cancel());
    if (active === 0) {
      $$('.visit-bar').forEach((el,i) => move(el, [
        {opacity:0, transform:'translate('+(i===2?'-72':'35')+'px,-35px) rotate(-6deg)'},
        {opacity:1, transform:'none'}
      ], 660, (i%4)*100 + (i>=4?70:0)));
    }
    if (active === 1) {
      if(change) interest=1-interest;
      choices.forEach((button,i)=>button.setAttribute('aria-pressed', String(i===interest)));
      const tips=interest===0?['Orla e mirantes','Passeios à beira-mar']:['Museus e galerias','Patrimônio histórico'];
      $$('.interest-results span').forEach((el,i)=>{
        el.textContent=tips[i];
        move(el,[{opacity:0,transform:'translateY(-14px) scale(.94)'},{opacity:1,transform:'none'}],440,130+i*130);
      });
    }
    if (active === 2) {
      $$('.ticket-sheet li b').forEach((el,i)=>move(el,[{opacity:0,transform:'scale(.35)'},{opacity:1,transform:'scale(1)'}],330,180+i*260));
      move($('.ticket-sheet'),[{transform:'translateY(12px) rotate(-3deg)'},{transform:'none'}],550);
    }
    if (active === 3) {
      const stops=$$('.stop');
      const starts=stops.map(el=>el.getBoundingClientRect().left);
      if(change) $('.stops').append(...[...stops].reverse());
      stops.forEach((el,i)=>{
        const offset=starts[i]-el.getBoundingClientRect().left;
        move(el,[{opacity:change?1:0,transform:'translate('+offset+'px,'+(change&&i!==1?-12:0)+'px)'},{opacity:1,transform:'none'}],620,change?0:i*160);
      });
    }
  }
  choices.forEach((button, i) => {
    button.onclick = () => {
      interest = i;
      explain();
    };
  });
  function showBenefit(i) {
    active=i;
    links.forEach((link,j)=>j===i?link.setAttribute('aria-current','true'):link.removeAttribute('aria-current'));
    diagrams.forEach((el,j)=>el.hidden=j!==i);
    panels.forEach((el,j)=>el.hidden=j!==i);
    explain();
  }
  function fromHash(){
    const index=links.findIndex(link=>link.hash===location.hash);
    showBenefit(index<0?0:index);
  }
  links.forEach((link,i)=>link.onclick=e=>{e.preventDefault();history.replaceState(null,'',link.hash);showBenefit(i);});
  $$('[data-action]').forEach(button=>button.onclick=()=>explain(true));
  window.addEventListener('hashchange',fromHash);
  fromHash();
  const firstView=new IntersectionObserver(([entry])=>{
    if(entry.isIntersecting){explain();firstView.disconnect();}
  },{threshold:.35});
  firstView.observe(board);
  const stages=$$('.stage'), tabs=$$('[data-stage]');
  const deck=$('#place-deck');
  const answers=new Map(Object.keys(destinations).map(name=>[name,[]]));
  let stage=0,city='Maldivas',pref='Cultura',epoch=0,busy=false;
  function update(){
    const votes=answers.get(city), places=destinations[city], done=votes.length===places.length;
    const labels=['Destino','Preferências de viagem','Tinder de viagem','Seu resumo'];
    tabs.forEach((b,i)=>{b.setAttribute('aria-pressed',String(stage===i));b.disabled=i===3&&!done;});
    stages.forEach((p,i)=>p.hidden=stage!==i);
    $('.flight-card').dataset.stage=String(stage);
    const pass=$('.journey-pass');pass.style.setProperty('--progress',stage/3);pass.dataset.stage=stage;
    $('.pass-status').textContent=labels[stage];$('.pass-city').textContent=city;$('.pass-pref').textContent=pref;$('.pass-pref').hidden=stage===0;
    $('#travel-photo').src='assets/'+city.toLowerCase()+'.jpg';$('#travel-photo').alt=city;
    deck.hidden=stage!==2||done;pass.hidden=!deck.hidden || stage===3;
    if(!deck.hidden){
      const [name,file]=places[votes.length];
      $('#swipe-image').src='assets/'+file;$('#swipe-image').alt=name;
      $('#swipe-name').textContent=name;$('#swipe-region').textContent=city;
    }
    $('.match-count').textContent=done?'Três lugares avaliados':city+' · Lugar '+(votes.length+1)+' de '+places.length;
    $('.review-votes').textContent='Lugares curtidos: '+votes.filter(Boolean).length+' de '+places.length;
    $('[data-city="'+city+'"]').setAttribute('aria-pressed','true');
    $$('[data-vote]').forEach(b=>b.disabled=busy||done);
    $('#chosen-city').textContent=city;$('#chosen-pref').textContent=pref;
    if(stage===3) window.showTravelRoutes(city,votes);
    else document.getElementById('route-map').hidden=true;
  }
  function go(index,focus=false){
    ++epoch;busy=false;
    deck.getAnimations().forEach(a=>a.cancel());
    stage=index===2&&answers.get(city).length===3?3:index;
    update();
    if(focus){const h=stages[stage].querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});}
  }
  tabs.forEach((b,i)=>b.onclick=()=>go(i));
  $$('[data-advance]').forEach(b=>b.onclick=()=>go(stage+1,true));
  $$('[data-city]').forEach(b=>b.onclick=()=>{
    city=b.dataset.city;$$('[data-city]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));update();
  });
  $$('[data-pref]').forEach(b=>b.onclick=()=>{
    pref=b.dataset.pref;$$('[data-pref]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));update();
    animate($('.pass-pref'),[{transform:'scale(.9)'},{transform:'scale(1)'}],{duration:200});
  });
  async function vote(like){
    if(stage!==2||busy||answers.get(city).length>=3)return;
    busy=true;const ticket=epoch;
    const sign=like?1:-1;
    const animation=animate(deck,[{transform:'none',opacity:1},{transform:'translateX('+sign*38+'%) rotate('+sign*8+'deg)',opacity:0}],{duration:230,easing:'ease-in',fill:'forwards'});
    if(animation){try{await animation.finished;}catch{return;}animation.cancel();}
    if(ticket!==epoch)return;
    answers.get(city).push(like);busy=false;
    if(answers.get(city).length===3){go(3,true);return;}
    update();
    animate(deck,[{transform:'scale(.96)',opacity:.5},{transform:'none',opacity:1}],{duration:220,easing:'ease-out'});
  }
  $$('[data-vote]').forEach(b=>b.onclick=()=>vote(b.dataset.vote==='like'));
  let touch=null;
  deck.onpointerdown=e=>{if(e.isPrimary&&!busy){touch={x:e.clientX,y:e.clientY};deck.setPointerCapture(e.pointerId);}};
  deck.onpointercancel=()=>touch=null;
  deck.onpointerup=e=>{
    if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)vote(dx>0);
  };
  $('.restart-votes').onclick=()=>{answers.set(city,[]);go(2,true);};
  if (location.hash === '#resumo-de-viagem') {
    answers.set('Maldivas', [true, false, true]);
    go(3);
    window.addEventListener('load', () => {
      document.getElementById('resumo-de-viagem').scrollIntoView({behavior:'instant'});
    }, {once:true});
  } else {
    go(0);
  }
})();

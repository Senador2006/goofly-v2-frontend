(() => {
  const byId = id => document.getElementById(id);
  const map = byId('route-map');
  const days = byId('route-days');
  const table = document.querySelector('.mini-itinerary table');
  const times = [['10:00', '12:00'], ['12:30', '13:30'], ['14:00', '16:00'], ['16:30', '18:00']];

  function drawDay(circuit, index) {
    const label = 'Dia ' + (index + 1);
    for (const [i, button] of Array.from(days.children).entries()) {
      button.setAttribute('aria-pressed', String(i === index));
    }
    byId('map-day').textContent = label;
    byId('map-heading').textContent = circuit.title;
    byId('route-image').src = 'assets/mapas/' + circuit.id + '.svg';
    byId('route-image').alt = 'Mapa de ' + circuit.title + ' com quatro pinos na ordem das paradas da tabela.';
    byId('map-key').textContent = circuit.routed ? 'Percurso a pé' : 'Ligação esquemática entre paradas';
    table.caption.textContent = label + ' · ' + circuit.title;
    byId('visit-rows').replaceChildren(...circuit.stops.map((name, i) => {
      const row = document.createElement('tr');
      const stop = document.createElement('th');
      stop.scope = 'row';
      const badge = document.createElement('span');
      badge.className = 'route-number';
      badge.textContent = i + 1;
      stop.append(badge, document.createTextNode(name));
      row.append(stop);
      for (const value of times[i]) {
        const time = document.createElement('time');
        time.dateTime = value;
        time.textContent = value;
        row.insertCell().append(time);
      }
      return row;
    }));
    byId('schedule-note').textContent = 'Horários locais sugeridos. ' + circuit.note;
  }

  window.showTravelRoutes = (city, votes) => {
    const circuits = window.gooflyCircuits[city].filter((_, i) => votes[i]);
    const empty = circuits.length === 0;
    map.hidden = table.hidden = byId('schedule-note').hidden = empty;
    byId('empty-visits').hidden = !empty;
    days.hidden = circuits.length < 2;
    days.replaceChildren(...circuits.map((circuit, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Dia ' + (i + 1);
      button.setAttribute('aria-label', button.textContent + ', ' + circuit.title);
      button.onclick = () => drawDay(circuit, i);
      return button;
    }));
    if (empty) byId('visit-rows').replaceChildren();
    else drawDay(circuits[0], 0);
  };
})();

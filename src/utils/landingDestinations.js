const u = (id, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`

export const heroDestinations = [
  {
    city: 'Maldivas',
    price: '\n',
    tag: 'Em destaque',
    img: u('photo-1514282401047-d79a71a590e8', 1200),
    span: true,
  },
  {
    city: 'Paris',
    price: '\n',
    img: u('photo-1502602898657-3e91760cbb34'),
  },
  {
    city: 'Bali',
    price: '\n',
    img: u('photo-1537996194471-e657df975ab4'),
  },
]

export const offers = [
  {
    city: 'Lisboa, Portugal',
    detail: 'Melhor época: abr – out · 5 a 7 dias',
    price: '\n',
    badge: 'Mais pedido',
    img: u('photo-1555881400-74d7acaacd8b'),
  },
  {
    city: 'Nova York, EUA',
    detail: 'O ano todo · 6 a 8 dias',
    price: '\n',
    badge: 'Cidade vibrante',
    img: u('photo-1496442226666-8d4d0e62e6e9'),
  },
  {
    city: 'Tóquio, Japão',
    detail: 'Mar – mai · 10 a 14 dias',
    price: '\n',
    badge: 'Cultura & sabor',
    img: u('photo-1540959733332-eab4deabeeaf'),
  },
  {
    city: 'Florianópolis, Brasil',
    detail: 'Dez – mar · 4 a 6 dias',
    price: '\n',
    badge: 'Praias & natureza',
    img: u('photo-1663001899005-a76fd718e2bf'),
  },
]

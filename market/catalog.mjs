export const categories = [
  { id: 'groceries', label: 'Sri Lankan Groceries', image: 'sambol', tint: '#f4e8d6' },
  { id: 'ingredients', label: 'Food & Ingredients', image: 'rice', tint: '#f5eedb' },
  { id: 'produce', label: 'Fresh Produce', image: 'limes', tint: '#e7eddb' },
  { id: 'snacks', label: 'Snacks & Sweets', image: 'biscuits', tint: '#f7e7de' },
  { id: 'drinks', label: 'Beverages', image: 'tea', tint: '#e5ecdf' },
  { id: 'household', label: 'Household Essentials', image: 'household', tint: '#f4edda' },
];
export const products = [
  { id:'samba-rice', name:'Red Samba Rice', category:'ingredients', image:'rice', size:'1 kg', price:490, stock:42, featured:1, best:1, description:'A small-grain red rice with a nutty finish. Serve with dhal, coconut sambol and your favourite curry.', other:['500 g',290,24] },
  { id:'roasted-curry', name:'Roasted Curry Powder', category:'ingredients', image:'curry', size:'100 g', price:390, was:460, stock:31, featured:1, best:1, description:'A fragrant roasted spice blend for deeply flavoured Sri Lankan curries. Fry briefly with onion and curry leaves to bring out the aroma.', other:['200 g',720,18] },
  { id:'coconut-milk', name:'Thick Coconut Milk', category:'ingredients', image:'coconut', size:'400 ml', price:590, stock:37, featured:1, best:1, description:'Rich coconut milk for creamy dhal, vegetable curries, kiribath and desserts.' },
  { id:'ginger-biscuits', name:'Sri Lankan Ginger Biscuits', category:'snacks', image:'biscuits', size:'200 g', price:360, stock:28, featured:1, best:1, description:'Crisp tea-time biscuits with a warming ginger bite. Especially good with a cup of Ceylon black tea.' },
  { id:'ceylon-tea', name:'Ceylon Black Tea', category:'drinks', image:'tea', size:'100 g', price:780, was:890, stock:24, featured:1, best:1, description:'Loose-leaf black tea with a bright, brisk finish. Brew to taste and serve plain or with milk.', other:['250 g',1690,10] },
  { id:'red-onions', name:'Red Onions & Curry Leaves', category:'produce', image:'onions', size:'250 g', price:320, stock:12, description:'Small red onions and aromatic curry leaves for the first step in a good curry.' },
  { id:'red-lentils', name:'Red Split Lentils', category:'ingredients', image:'lentils', size:'500 g', price:490, stock:34, description:'Quick-cooking red lentils for parippu. Simmer with turmeric and finish with coconut milk and tempered spices.', other:['1 kg',890,15] },
  { id:'seeni-sambol', name:'Seeni Sambol', category:'groceries', image:'sambol', size:'200 g', price:690, stock:19, description:'Slow-cooked caramelised onion relish with a sweet, tangy warmth. Spoon onto bread, hoppers or rice.' },
  { id:'plain-hoppers', name:'Traditional Plain Hoppers', category:'groceries', image:'hoppers', size:'Pack of 5', price:550, stock:8, description:'Bowl-shaped rice pancakes with crisp edges. Warm before serving with sambol or curry.' },
  { id:'lime-chilli', name:'Fresh Limes & Green Chillies', category:'produce', image:'limes', size:'250 g', price:290, stock:0, description:'A fresh cooking duo for sambol, marinades and last-minute seasoning.' },
  { id:'dishwash', name:'Lime Dishwashing Liquid', category:'household', image:'household', size:'500 ml', price:680, stock:16, description:'Lime-scented washing-up liquid for dishes, pots and pans.' },
  { id:'curry-night', name:'Sri Lankan Curry Night Bundle', category:'groceries', image:'bundle', size:'4 pantry items', price:1690, was:1960, stock:14, description:'Roasted curry powder, whole spices, chilli flakes and coconut milk in one cooking kit.' },
].map(({other, ...product}) => ({
  ...product,
  was: product.was ?? null,
  featured: Boolean(product.featured),
  best: Boolean(product.best),
  variants: [
    {id: product.id + '-standard', label: product.size, price: product.price, was: product.was ?? null, stock: product.stock},
    ...(other ? [{id: product.id + '-alternate', label: other[0], price: other[1], was: null, stock: other[2]}] : []),
  ],
}));

export const sampleSettings = {
  freeDelivery: 5000,
  minimum: 1500,
  collection: true,
  deliveryAreas: [
    { label: 'Colombo 01–15', from: '00100', to: '01500', fee: 350 },
    { label: 'Greater Colombo', from: '10100', to: '10699', fee: 500 },
  ],
  slots: ['09:00–12:00', '12:00–15:00', '15:00–18:00'],
  banner: 'Free delivery on eligible orders over Rs. 5,000',
  heroHeading: 'Sri Lankan groceries',
  heroCopy: 'Shop rice, spices, snacks and Ceylon tea.',
  email: '',
  whatsapp: '',
  preview: true,
};

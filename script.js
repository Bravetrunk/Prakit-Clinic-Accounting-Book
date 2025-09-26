// --- Config (overridable via window.APP_CONFIG in menu-data.js) ---
const DEFAULT_CONFIG = { taxRate: 0.07, currency: 'USD', locale: 'en-US' };
const CONFIG = Object.assign({}, DEFAULT_CONFIG, window.APP_CONFIG || {});
const TAX_RATE = CONFIG.taxRate;
const currency = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency });

// --- Helpers ---
function slugify(s){
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\\p{Letter}\\p{Number}]+/gu, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeCategory(cat){
  const id = cat.id && String(cat.id).trim() ? String(cat.id) : slugify(cat.name);
  const name = String(cat.name || '').trim();
  const emoji = cat.emoji || '🍽️';
  const note = (cat.note && String(cat.note).trim()) || '';
  const items = (cat.items || []).map(it => {
    const iid = it.id && String(it.id).trim() ? String(it.id) : slugify(it.name);
    const raw = it.price;
    const priceNum = typeof raw === 'string' ? parseFloat(raw.replace(/[^\\d.]/g,'')) : Number(raw);
    const price = Number.isFinite(priceNum) ? priceNum : null;
    const description = (it.description && String(it.description).trim()) || '';
    return { id: iid, name: String(it.name || '').trim(), price, description };
  });
  return { id, name, emoji, note, items };
}

// --- Data (MENU_DATA provided by menu-data.js) ---
const DEFAULT_MENU = [
  { name: 'Small Plates', emoji: '🥟', items: [] }
];
const RAW_MENU = (Array.isArray(window.MENU_DATA) && window.MENU_DATA.length) ? window.MENU_DATA : DEFAULT_MENU;
const CATEGORIES = RAW_MENU.map(normalizeCategory);

// --- State ---
let activeCategoryId = CATEGORIES[0]?.id || '';
const cart = new Map(); // key: itemId, value: { item, qty }

// --- DOM ---
const els = {
  categoryList: document.getElementById('category-list'),
  currentCategoryTitle: document.getElementById('current-category-title'),
  currentCategoryNote: document.getElementById('current-category-note'),
  menuItems: document.getElementById('menu-items'),
  cartList: document.getElementById('cart-items'),
  cartEmpty: document.getElementById('cart-empty'),
  subtotal: document.getElementById('subtotal-amount'),
  tax: document.getElementById('tax-amount'),
  total: document.getElementById('total-amount'),
  clearBtn: document.getElementById('clear-order-btn'),
  payBtn: document.getElementById('pay-now-btn'),
  currentTime: document.getElementById('current-time')
};

// --- Rendering ---
function renderCategories(){
  els.categoryList.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item' + (cat.id === activeCategoryId ? ' active' : '');
    li.setAttribute('role','button');
    li.setAttribute('tabindex','0');
    li.dataset.id = cat.id;

    const emoji = document.createElement('span');
    emoji.className = 'category-emoji';
    emoji.textContent = cat.emoji;

    const label = document.createElement('span');
    label.textContent = cat.name;

    li.appendChild(emoji);
    li.appendChild(label);

    li.addEventListener('click', () => setActiveCategory(cat.id));
    li.addEventListener('keypress', (e)=>{ if(e.key==='Enter' || e.key===' ') setActiveCategory(cat.id); });

    els.categoryList.appendChild(li);
  });
}

function renderMenuItems(){
  const category = CATEGORIES.find(c=>c.id===activeCategoryId);
  els.currentCategoryTitle.textContent = category?.name || 'Menu';

  if (els.currentCategoryNote) {
    const note = category?.note || '';
    els.currentCategoryNote.textContent = note;
    els.currentCategoryNote.style.display = note ? 'block' : 'none';
  }

  els.menuItems.innerHTML = '';
  (category?.items || []).forEach(item=>{
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.setAttribute('role','listitem');

    const title = document.createElement('h3');
    title.className = 'menu-title';
    title.textContent = item.name;

    const desc = document.createElement('div');
    desc.className = 'menu-desc';
    desc.textContent = item.description || '';

    const price = document.createElement('div');
    price.className = 'menu-price';
    price.textContent = item.price == null ? 'Set price' : currency.format(item.price);

    const btn = document.createElement('button');
    btn.type = 'button';
    if (item.price == null) {
      btn.textContent = 'Set price';
      btn.classList.add('btn-set-price');
      btn.addEventListener('click', ()=> setPriceFlow(item));
    } else {
      btn.textContent = 'Add';
      btn.addEventListener('click', ()=> addToCart(item));
    }

    card.appendChild(title);
    if (item.description) card.appendChild(desc);
    card.appendChild(price);
    card.appendChild(btn);
    els.menuItems.appendChild(card);
  });
}

function renderCart(){
  els.cartList.innerHTML = '';
  if(cart.size === 0){
    els.cartList.appendChild(els.cartEmpty);
    els.cartEmpty.style.display = 'block';
    return;
  }
  els.cartEmpty.style.display = 'none';

  for(const [id, entry] of cart.entries()){
    const row = document.createElement('div');
    row.className = 'cart-row';

    const main = document.createElement('div');
    main.className = 'cart-row-main';

    const name = document.createElement('p');
    name.className = 'cart-name';
    name.textContent = entry.item.name;

    const meta = document.createElement('div');
    meta.className = 'cart-meta';
    meta.textContent = `${currency.format(entry.item.price)} each`;

    main.appendChild(name);
    if (entry.item.description) {
      const d = document.createElement('div');
      d.className = 'cart-meta';
      d.textContent = entry.item.description;
      main.appendChild(d);
    } else {
      main.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'cart-row-actions';

    const qty = document.createElement('div');
    qty.className = 'qty-control';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'qty-btn';
    minus.setAttribute('aria-label', 'Decrease quantity');
    minus.textContent = '−';
    minus.addEventListener('click', ()=> changeQty(id, entry.qty - 1));

    const qv = document.createElement('span');
    qv.className = 'qty-value';
    qv.textContent = entry.qty;

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'qty-btn';
    plus.setAttribute('aria-label', 'Increase quantity');
    plus.textContent = '+';
    plus.addEventListener('click', ()=> changeQty(id, entry.qty + 1));

    qty.appendChild(minus);
    qty.appendChild(qv);
    qty.appendChild(plus);

    const lineTotal = document.createElement('div');
    lineTotal.className = 'line-total';
    lineTotal.textContent = currency.format(entry.item.price * entry.qty);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-btn';
    remove.textContent = 'Remove';
    remove.addEventListener('click', ()=> removeFromCart(id));

    actions.appendChild(qty);
    actions.appendChild(lineTotal);
    actions.appendChild(remove);

    row.appendChild(main);
    row.appendChild(actions);
    els.cartList.appendChild(row);
  }
}

function updateTotals(){
  let subtotal = 0;
  for(const {item, qty} of cart.values()){
    subtotal += item.price * qty;
  }
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  els.subtotal.textContent = currency.format(subtotal);
  els.tax.textContent = currency.format(tax);
  els.total.textContent = currency.format(total);

  els.payBtn.disabled = cart.size === 0;
}

// --- Actions ---
function setPriceFlow(item){
  const input = prompt(`Enter price for "${item.name}" (${CONFIG.currency})`);
  if (input == null) return;
  const num = parseFloat(String(input).replace(/[^\\d.]/g,''));
  if (!Number.isFinite(num) || num < 0) {
    alert('Please enter a valid non-negative number.');
    return;
  }
  item.price = +num.toFixed(2);
  renderMenuItems();
}

function setActiveCategory(id){
  activeCategoryId = id;
  renderCategories();
  renderMenuItems();
}

function addToCart(item){
  if (item.price == null) {
    setPriceFlow(item);
    return;
  }
  if(!cart.has(item.id)){
    cart.set(item.id, { item, qty: 1 });
  } else {
    cart.get(item.id).qty += 1;
  }
  renderCart();
  updateTotals();
}

function changeQty(itemId, newQty){
  if(!cart.has(itemId)) return;
  if(newQty <= 0){
    cart.delete(itemId);
  } else {
    cart.get(itemId).qty = newQty;
  }
  renderCart();
  updateTotals();
}

function removeFromCart(itemId){
  cart.delete(itemId);
  renderCart();
  updateTotals();
}

function clearOrder(){
  if(cart.size === 0) return;
  const ok = confirm('Clear the current order?');
  if(!ok) return;
  cart.clear();
  renderCart();
  updateTotals();
}

function payNow(){
  if(cart.size === 0) return;
  const itemsText = Array.from(cart.values())
    .map(({item, qty})=> `${qty} × ${item.name}`)
    .join('\\n');
  alert(`Order placed:\\n\\n${itemsText}\\n\\n${els.total.textContent} charged. Thank you!`);
  cart.clear();
  renderCart();
  updateTotals();
}

function startClock(){
  const formatTime = () => {
    const d = new Date();
    const date = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'2-digit', year:'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    els.currentTime.textContent = `${date} ${time}`;
  };
  formatTime();
  setInterval(formatTime, 1000);
}

// --- Init ---
function init(){
  renderCategories();
  renderMenuItems();
  renderCart();
  updateTotals();

  els.clearBtn.addEventListener('click', clearOrder);
  els.payBtn.addEventListener('click', payNow);

  startClock();
}

document.addEventListener('DOMContentLoaded', init);

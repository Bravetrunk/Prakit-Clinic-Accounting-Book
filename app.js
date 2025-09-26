// app.js
// Firebase v10 modular CDN imports
import { initializeApp } from "<https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js>";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from "<https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js>";
import {
  getFirestore, collection, addDoc, doc, setDoc, getDocs, onSnapshot, query, where, orderBy, serverTimestamp, updateDoc, enableIndexedDbPersistence
} from "<https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js>";

/* 1) Paste your Firebase config here */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/* 2) Initialize Firebase */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Offline cache (optional)
enableIndexedDbPersistence(db).catch(() => { /* ignore if multiple tabs */ });

/* --- UI Elements --- */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");
const authStatusEl = document.getElementById("authStatus");
const signOutBtn = document.getElementById("signOutBtn");

const menuListEl = document.getElementById("menuList");
const categoryChipsEl = document.getElementById("categoryChips");
const searchInputEl = document.getElementById("searchInput");

const cartItemsEl = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const serviceEl = document.getElementById("service");
const totalEl = document.getElementById("total");
const clearCartBtn = document.getElementById("clearCartBtn");
const chargeBtn = document.getElementById("chargeBtn");
const orderTypeEl = document.getElementById("orderType");
const tableNumberEl = document.getElementById("tableNumber");
const paymentMethodEl = document.getElementById("paymentMethod");

const orderStatusFilterEl = document.getElementById("orderStatusFilter");
const ordersListEl = document.getElementById("ordersList");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");

const vatPctEl = document.getElementById("vatPct");
const svcPctEl = document.getElementById("svcPct");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const reloadMenuBtn = document.getElementById("reloadMenuBtn");

/* --- App State --- */
let user = null;
let menu = [];           // {id, name, category, price, desc, spicy, veg, active}
let categories = [];
let cart = {};           // {menuId: {id, name, price, qty}}
let settings = {
  vatPct: 7,
  svcPct: 0
};
let currentCategory = "All";
let menuUnsub = null;
let ordersUnsub = null;

/* --- Helpers --- */
const fmt = (n) => `THB ${n.toFixed(2)}`;
const el = (sel, parent = document) => parent.querySelector(sel);
const cloneTpl = (tplId) => el(`#${tplId}`).content.firstElementChild.cloneNode(true);

function calcTotals() {
  const subtotal = Object.values(cart).reduce((sum, it) => sum + it.price * it.qty, 0);
  const tax = subtotal * (settings.vatPct / 100);
  const svc = subtotal * (settings.svcPct / 100);
  const total = subtotal + tax + svc;
  return { subtotal, tax, svc, total };
}

function saveLocal() {
  localStorage.setItem("pos_cart", JSON.stringify(cart));
  localStorage.setItem("pos_settings", JSON.stringify(settings));
}
function loadLocal() {
  try {
    cart = JSON.parse(localStorage.getItem("pos_cart")) || {};
    settings = { ...settings, ...(JSON.parse(localStorage.getItem("pos_settings")) || {}) };
  } catch {}
  vatPctEl.value = settings.vatPct;
  svcPctEl.value = settings.svcPct;
}

/* --- Auth --- */
onAuthStateChanged(auth, (u) => {
  if (u) {
    user = u;
    authStatusEl.textContent = `Signed in (anonymous)`;
    signOutBtn.hidden = false;
    subscribeMenu();
    subscribeOrders();
    renderCart();
  } else {
    user = null;
    authStatusEl.textContent = "Not signed in";
    signOutBtn.hidden = true;
  }
});
signOutBtn.addEventListener("click", () => signOut(auth));
signInAnonymously(auth).catch(console.error);

/* --- Tabs --- */
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    el(`#${btn.dataset.tab}`).classList.add("active");
  });
});

/* --- Menu --- */
function subscribeMenu() {
  if (menuUnsub) menuUnsub();
  const q = query(collection(db, "menu")); // all items
  menuUnsub = onSnapshot(q, (snap) => {
    menu = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false);
    categories = ["All", ...Array.from(new Set(menu.map(m => m.category)))];
    renderCategoryChips();
    renderMenu();
  });
}

function renderCategoryChips() {
  categoryChipsEl.innerHTML = "";
  categories.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "chip" + (cat === currentCategory ? " active" : "");
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      currentCategory = cat;
      categoryChipsEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderMenu();
    });
    categoryChipsEl.appendChild(chip);
  });
}

searchInputEl.addEventListener("input", () => renderMenu());
reloadMenuBtn.addEventListener("click", () => renderMenu());

function renderMenu() {
  const term = searchInputEl.value?.toLowerCase() || "";
  const filtered = menu.filter(m => {
    const okCat = currentCategory === "All" || m.category === currentCategory;
    const okTerm = !term || [m.name, m.description, m.category].join(" ").toLowerCase().includes(term);
    return okCat && okTerm;
  });
  menuListEl.innerHTML = "";
  filtered.forEach(m => {
    const card = cloneTpl("menuItemTpl");
    el(".name", card).textContent = m.name;
    el(".price", card).textContent = fmt(m.price || 0);
    el(".desc", card).textContent = m.description || "";
    const tags = el(".tags", card);
    if (m.veg) { const t = document.createElement("span"); t.className = "tag"; t.textContent = "Veg"; tags.appendChild(t);}
    if (m.spicyLevel > 0) { const t = document.createElement("span"); t.className = "tag"; t.textContent = "Spicy"; tags.appendChild(t);}
    el(".addBtn", card).addEventListener("click", () => addToCart(m));
    menuListEl.appendChild(card);
  });
}

/* --- Cart --- */
function addToCart(item) {
  if (!cart[item.id]) {
    cart[item.id] = { id: item.id, name: item.name, price: item.price || 0, qty: 1 };
  } else {
    cart[item.id].qty += 1;
  }
  renderCart();
}
function updateQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}
function removeFromCart(id) {
  delete cart[id];
  renderCart();
}
function clearCart() {
  cart = {};
  renderCart();
}
clearCartBtn.addEventListener("click", clearCart);

function renderCart() {
  cartItemsEl.innerHTML = "";
  Object.values(cart).forEach(ci => {
    const row = cloneTpl("cartItemTpl");
    el(".name", row).textContent = ci.name;
    el(".price", row).textContent = fmt(ci.price);
    el(".count", row).textContent = ci.qty;
    el(".line-total", row).textContent = fmt(ci.price * ci.qty);
    row.querySelectorAll(".qtyBtn").forEach(btn => {
      btn.addEventListener("click", () => updateQty(ci.id, parseInt(btn.dataset.delta)));
    });
    el(".removeBtn", row).addEventListener("click", () => removeFromCart(ci.id));
    cartItemsEl.appendChild(row);
  });
  const { subtotal, tax, svc, total } = calcTotals();
  subtotalEl.textContent = fmt(subtotal);
  taxEl.textContent = fmt(tax);
  serviceEl.textContent = fmt(svc);
  totalEl.textContent = fmt(total);
  chargeBtn.disabled = total <= 0;
  saveLocal();
}

/* --- Checkout --- */
chargeBtn.addEventListener("click", async () => {
  if (!user) return alert("Not signed in.");
  const items = Object.values(cart).map(ci => ({
    menuId: ci.id, name: ci.name, qty: ci.qty, price: ci.price, lineTotal: ci.price * ci.qty
  }));
  const { subtotal, tax, svc, total } = calcTotals();
  const payload = {
    createdAt: serverTimestamp(),
    status: "paid", // direct-charge; change to "open" if you want two-step
    cashierUid: user.uid,
    orderType: orderTypeEl.value,
    table: tableNumberEl.value || null,
    payment: { method: paymentMethodEl.value, paidAt: serverTimestamp() },
    items, subtotal, tax, service: svc, total, currency: "THB"
  };
  chargeBtn.disabled = true;
  try {
    await addDoc(collection(db, "orders"), payload);
    clearCart();
    alert("Payment recorded.");
    tabs.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    document.querySelector('[data-tab="orders"]').classList.add("active");
    document.getElementById("orders").classList.add("active");
  } catch (e) {
    console.error(e);
    alert("Failed to create order.");
  } finally {
    chargeBtn.disabled = false;
  }
});

/* --- Orders --- */
function subscribeOrders() {
  if (ordersUnsub) ordersUnsub();
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  ordersUnsub = onSnapshot(q, () => renderOrders());
}
orderStatusFilterEl.addEventListener("change", () => renderOrders());
refreshOrdersBtn.addEventListener("click", () => renderOrders());

async function renderOrders() {
  const statusFilter = orderStatusFilterEl.value;
  const qBase = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qBase);
  let orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (statusFilter !== "all") {
    orders = orders.filter(o => o.status === statusFilter);
  }
  ordersListEl.innerHTML = "";
  orders.forEach(o => {
    const card = document.createElement("div");
    card.className = "order-card";
    const created = o.createdAt?.toDate?.() ? o.createdAt.toDate() : new Date();
    card.innerHTML = `
      <div class="header">
        <h3>#${o.id.slice(-6).toUpperCase()}</h3>
        <span style="color: var(--muted)">${created.toLocaleString()}</span>
      </div>
      <div><strong>Status:</strong> ${o.status}</div>
      <div><strong>Type:</strong> ${o.orderType || "-"} ${o.table ? `(Table ${o.table})` : ""}</div>
      <div class="items">${o.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</div>
      <div><strong>Total:</strong> ${fmt(o.total || 0)} • <strong>Pay:</strong> ${o.payment?.method || "-"}</div>
      <div class="actions"></div>
    `;
    const actions = el(".actions", card);
    if (o.status === "open") {
      const markPaid = document.createElement("button");
      markPaid.className = "primary sm";
      markPaid.textContent = "Mark paid";
      markPaid.addEventListener("click", async () => {
        await updateDoc(doc(db, "orders", o.id), {
          status: "paid",
          payment: { ...(o.payment || {}), paidAt: serverTimestamp() }
        });
      });
      actions.appendChild(markPaid);
    }
    const voidBtn = document.createElement("button");
    voidBtn.className = "ghost sm";
    voidBtn.textContent = "Void";
    voidBtn.addEventListener("click", async () => {
      if (!confirm("Void this order?")) return;
      await updateDoc(doc(db, "orders", o.id), { status: "void" });
    });
    actions.appendChild(voidBtn);

    ordersListEl.appendChild(card);
  });
}

/* --- Settings --- */
saveSettingsBtn.addEventListener("click", () => {
  settings.vatPct = parseFloat(vatPctEl.value || "0");
  settings.svcPct = parseFloat(svcPctEl.value || "0");
  renderCart();
});

/* --- Init --- */
loadLocal();

// --- DATABASE CONFIGURATION ---
const SUPABASE_URL = "https://hlyzobxyijwndohxwhuo.supabase.co";
const SUPABASE_KEY = "sb_publishable_eb1wANvveNRCPxXYvnNG7A_L3BDkzYL";

let sb = null, authMode = "login", transactions = [], activePage = "dashboard";

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const today = new Date();

$("globalMonth").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
$("txDate").value = today.toISOString().slice(0, 10);

try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.getSession().then(({ data }) => data.session ? showApp() : showAuth());
  sb.auth.onAuthStateChange((event, session) => session ? showApp() : showAuth());
} catch (e) { console.error("Error Supabase:", e); }

function showAuth() {
  $("app").classList.add("hidden");
  $("mainNav").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("authCard").classList.remove("hidden");
}

function showApp() {
  $("authCard").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("mainNav").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  loadTransactions();
}

// Navigasi Halaman
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activePage = btn.dataset.page;
    switchPage(activePage);
  };
});

function switchPage(page) {
  if (page === "dashboard") {
    $("page-dashboard").classList.remove("hidden");
    $("page-module").classList.add("hidden");
  } else {
    $("page-dashboard").classList.add("hidden");
    $("page-module").classList.remove("hidden");
    
    const titles = { date: "Keuangan Date", tabungan: "Tabungan", pribadi: "Keuangan Pribadi" };
    $("moduleTitle").textContent = titles[page];
  }
  render();
}

// Auth Login / Register
document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  authMode = b.dataset.mode;
  $("authTitle").textContent = authMode === "login" ? "Masuk" : "Daftar";
  $("authBtn").textContent = authMode === "login" ? "Masuk" : "Buat akun";
});

$("authBtn").onclick = async () => {
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) return $("authMsg").textContent = "Email & password wajib.";
  let res = authMode === "login" 
    ? await sb.auth.signInWithPassword({ email, password }) 
    : await sb.auth.signUp({ email, password });
  if (res.error) $("authMsg").textContent = res.error.message;
};

$("logoutBtn").onclick = () => sb.auth.signOut();
$("globalMonth").onchange = render;

// Handling Form Modal Transaksi
const walletMapping = { date: "bersama", tabungan: "pasangan", pribadi: "hilal" };

$("addBtn").onclick = () => {
  $("txForm").reset();
  $("txId").value = "";
  $("txWallet").value = walletMapping[activePage];
  $("dialogTitle").textContent = `Tambah (${$("moduleTitle").textContent})`;
  $("txDate").value = today.toISOString().slice(0, 10);
  $("txDialog").showModal();
};

$("cancelTx").onclick = () => $("txDialog").close();

$("txForm").onsubmit = async (e) => {
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser();
  const txId = $("txId").value;
  
  const row = {
    user_id: user.id,
    date: $("txDate").value,
    type: $("txType").value,
    amount: Number($("txAmount").value),
    category: $("txCategory").value,
    wallet: $("txWallet").value,
    note: $("txNote").value.trim()
  };

  let error = txId 
    ? (await sb.from("transactions").update(row).eq("id", txId)).error 
    : (await sb.from("transactions").insert(row)).error;

  if (error) return alert(error.message);
  $("txDialog").close();
  loadTransactions();
};

window.editTx = (id) => {
  const t = transactions.find(item => item.id == id);
  if (!t) return;
  $("txId").value = t.id;
  $("txWallet").value = t.wallet;
  $("txDate").value = t.date;
  $("txType").value = t.type;
  $("txAmount").value = t.amount;
  $("txCategory").value = t.category;
  $("txNote").value = t.note || "";
  $("dialogTitle").textContent = "Edit Transaksi";
  $("txDialog").showModal();
};

window.deleteTx = async (id) => {
  if (!confirm("Hapus transaksi ini?")) return;
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) alert(error.message);
  else loadTransactions();
};

async function loadTransactions() {
  const { data, error } = await sb.from("transactions").select("*").order("date", { ascending: false });
  if (error) return console.error(error);
  transactions = data || [];
  render();
}

function render() {
  const month = $("globalMonth").value;
  const filtered = transactions.filter(t => t.date?.slice(0, 7) === month);

  // 1. RENDER DASHBOARD
  const sumIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const sumExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  
  const calcNet = (w) => filtered.filter(t => t.wallet === w).reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  $("dashTotalNet").textContent = rupiah(sumIncome - sumExpense);
  $("dashNetDate").textContent = rupiah(calcNet("bersama"));
  $("dashNetTabungan").textContent = rupiah(calcNet("pasangan"));
  $("dashNetPribadi").textContent = rupiah(calcNet("hilal"));
  $("dashTotalIncome").textContent = rupiah(sumIncome);
  $("dashTotalExpense").textContent = rupiah(sumExpense);

  $("dashTransactions").innerHTML = filtered.slice(0, 5).map(t => renderTxRow(t)).join("") || '<p class="muted">Belum ada transaksi.</p>';

  // 2. RENDER HALAMAN MODUL
  if (activePage !== "dashboard") {
    const targetWallet = walletMapping[activePage];
    const modTx = filtered.filter(t => t.wallet === targetWallet);
    
    const inc = modTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = modTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    $("modIncome").textContent = rupiah(inc);
    $("modExpense").textContent = rupiah(exp);
    $("modNet").textContent = rupiah(inc - exp);
    $("modCount").textContent = `${modTx.length} transaksi`;

    const cats = {};
    modTx.filter(t => t.type === "expense").forEach(t => cats[t.category] = (cats[t.category] || 0) + t.amount);
    const max = Math.max(...Object.values(cats), 1);

    $("modCategories").innerHTML = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => 
      `<div class="categoryRow"><div class="categoryMeta"><span>${escapeHtml(c)}</span><b>${rupiah(v)}</b></div><div class="bar"><i style="width:${v / max * 100}%"></i></div></div>`
    ).join("") || '<p class="muted">Belum ada pengeluaran.</p>';

    $("modTransactions").innerHTML = modTx.map(t => renderTxRow(t)).join("") || '<p class="muted">Belum ada transaksi di modul ini.</p>';
  }
}

function renderTxRow(t) {
  return `<div class="tx">
    <div>
      <div class="note">${escapeHtml(t.note || t.category)}</div>
      <div class="meta" style="font-size:11px;color:#64748b;">${t.date} · ${escapeHtml(t.category)}</div>
    </div>
    <div style="text-align:right;">
      <div class="money ${t.type === "expense" ? "expenseMoney" : "incomeMoney"}">${t.type === "expense" ? "-" : "+"}${rupiah(t.amount)}</div>
      <div style="margin-top:2px;font-size:11px;">
        <a href="#" onclick="editTx(${t.id}); return false;" style="color:#2563eb;margin-right:6px;">Edit</a>
        <a href="#" onclick="deleteTx(${t.id}); return false;" style="color:#dc2626;">Hapus</a>
      </div>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
```[cite: 1]

---

### Cara Memasang:
1. Ganti semua isi `index.html`, `style.css`, dan `app.js` di GitHub kamu dengan kode baru ini[cite: 1, 3, 4].
2. Jangan lupa untuk tetap **mengisi `SUPABASE_KEY`** pada baris ke-3 di file `app.js`[cite: 1, 5].
3. Klik **Commit Changes** lalu *refresh* websitemu[cite: 3]!

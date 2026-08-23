const SUPABASE_URL = "https://hlyzobxyijwndohxwhuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseXpvYnh5aWp3bmRvaHh3aHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjQ5NzksImV4cCI6MjEwMzA0MDk3OX0.4eAwD2XB0OMBaoe0wcXHgi7b42r4B8GC6qV2iU6mTIE";

let sb = null, transactions = [];

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const dollar = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const today = new Date();

$("month").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
$("txDate").value = today.toISOString().slice(0, 10);

try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.getSession().then(({ data }) => {
    if (data?.session) {
      $("logoutBtn").classList.remove("hidden");
      loadTransactions();
    } else {
      window.location.href = "index.html"; // Redirect ke login jika belum masuk
    }
  });
} catch(e) { console.error(e); }

$("logoutBtn").onclick = () => {
  sb.auth.signOut().then(() => window.location.href = "index.html");
};

$("month").onchange = loadTransactions;
$("addBtn").onclick = () => $("txDialog").showModal();
$("cancelTx").onclick = () => $("txDialog").close();

$("txForm").onsubmit = async (e) => {
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser();
  
  const currency = $("txCurrency").value;
  const rawNote = $("txNote").value.trim();
  const noteWithCurrency = `[${currency}] ${rawNote}`;

  const row = {
    user_id: user.id,
    date: $("txDate").value,
    type: "expense", // Investasi dihitung sebagai alokasi dana keluar
    amount: Number($("txAmount").value),
    category: $("txCategory").value,
    wallet: "hilal", // Menyimpan khusus di dompet Hilal
    note: noteWithCurrency
  };

  const { error } = await sb.from("transactions").insert(row);
  if (error) return alert(error.message);
  
  $("txForm").reset();
  $("txDate").value = today.toISOString().slice(0, 10);
  $("txDialog").close();
  loadTransactions();
};

async function loadTransactions() {
  const { data, error } = await sb.from("transactions").select("*").eq("wallet", "hilal").order("date", { ascending: false });
  if (error) return alert("Gagal mengambil data: " + error.message);
  transactions = data || [];
  render();
}

function render() {
  const month = $("month").value;
  const filtered = transactions.filter(t => t.date?.slice(0, 7) === month);

  let totalIdr = 0;
  let totalUsd = 0;

  filtered.forEach(t => {
    if (t.note && t.note.includes("[USD]")) {
      totalUsd += t.amount;
    } else {
      totalIdr += t.amount;
    }
  });

  $("totalIdr").textContent = rupiah(totalIdr);
  $("totalUsd").textContent = dollar(totalUsd);

  $("transactions").innerHTML = filtered.map(t => {
    const isUsd = t.note && t.note.includes("[USD]");
    const cleanNote = t.note ? t.note.replace("[USD]", "").replace("[IDR]", "").trim() : t.category;
    const formattedAmount = isUsd ? dollar(t.amount) : rupiah(t.amount);

    return `<div class="tx">
      <div>
        <div class="note"><b>${escapeHtml(cleanNote || t.category)}</b> <span style="font-size:10px; padding:2px 4px; background:#eef1f6; border-radius:4px;">${isUsd ? 'USD' : 'IDR'}</span></div>
        <div class="meta">${t.date} · ${escapeHtml(t.category)}</div>
      </div>
      <div class="money" style="color:#1f6feb;">${formattedAmount}</div>
    </div>`;
  }).join("") || '<p class="muted">Belum ada catatan investasi bulan ini.</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

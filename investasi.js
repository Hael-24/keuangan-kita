const SUPABASE_URL = "https://hlyzobxyijwndohxwhuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseXpvYnh5aWp3bmRvaHh3aHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjQ5NzksImV4cCI6MjEwMzA0MDk3OX0.4eAwD2XB0OMBaoe0wcXHgi7b42r4B8GC6qV2iU6mTIE";

let sb = null, investments = [];

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
      loadInvestments();
    } else {
      window.location.href = "index.html"; // Balik ke halaman awal jika belum masuk
    }
  });
} catch(e) { console.error(e); }

$("logoutBtn").onclick = () => {
  sb.auth.signOut().then(() => window.location.href = "index.html");
};

$("month").onchange = loadInvestments;

// Tombol Tambah Investasi
$("addBtn").onclick = () => {
  $("txForm").reset();
  $("txId").value = "";
  $("dialogTitle").textContent = "Tambah Investasi";
  $("txDate").value = today.toISOString().slice(0, 10);
  $("txDialog").showModal();
};

$("cancelTx").onclick = () => $("txDialog").close();

// Submit Form (Tambah / Edit CRUD)
$("txForm").onsubmit = async (e) => {
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser();
  const txId = $("txId").value;
  
  const currency = $("txCurrency").value;
  const rawNote = $("txNote").value.trim();
  // Menyimpan format mata uang khusus di note agar independen
  const cleanNote = rawNote.replace(/^\[(USD|IDR)\]\s*/, "");
  const noteWithCurrency = `[${currency}] ${cleanNote}`;

  const row = {
    user_id: user.id,
    date: $("txDate").value,
    type: "income", 
    amount: Number($("txAmount").value),
    category: $("txCategory").value,
    wallet: "investasi_hilal", // Wallet khusus terpisah
    note: noteWithCurrency
  };

  let res = txId 
    ? await sb.from("transactions").update(row).eq("id", txId)
    : await sb.from("transactions").insert(row);

  if (res.error) return alert("Gagal menyimpan: " + res.error.message);
  
  $("txForm").reset();
  $("txDialog").close();
  loadInvestments();
};

// Fungsi Edit Data
window.editTx = (id) => {
  const item = investments.find(t => t.id == id);
  if (!item) return;

  $("txId").value = item.id;
  $("txDate").value = item.date;
  $("txAmount").value = item.amount;
  $("txCategory").value = item.category;

  const isUsd = item.note && item.note.includes("[USD]");
  $("txCurrency").value = isUsd ? "USD" : "IDR";
  
  const cleanNote = item.note ? item.note.replace(/^\[(USD|IDR)\]\s*/, "") : "";
  $("txNote").value = cleanNote;

  $("dialogTitle").textContent = "Edit Investasi";
  $("txDialog").showModal();
};

// Fungsi Hapus Data
window.deleteTx = async (id) => {
  if (!confirm("Yakin ingin menghapus catatan investasi ini?")) return;
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) alert("Gagal menghapus: " + error.message);
  else loadInvestments();
};

async function loadInvestments() {
  const { data, error } = await sb.from("transactions").select("*").eq("wallet", "investasi_hilal").order("date", { ascending: false });
  if (error) return console.error(error);
  investments = data || [];
  render();
}

function render() {
  const month = $("month").value;
  const filtered = investments.filter(t => t.date?.slice(0, 7) === month);

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
    const cleanNote = t.note ? t.note.replace(/^\[(USD|IDR)\]\s*/, "").trim() : t.category;
    const formattedAmount = isUsd ? dollar(t.amount) : rupiah(t.amount);

    return `<div class="tx">
      <div>
        <div class="note"><b>${escapeHtml(cleanNote || t.category)}</b> <span style="font-size:10px; padding:2px 6px; background:#e2e8f0; border-radius:4px; font-weight:bold; color:#334155;">${isUsd ? 'USD' : 'IDR'}</span></div>
        <div class="meta" style="font-size:11px; color:#64748b; margin-top:2px;">${t.date} · ${escapeHtml(t.category)}</div>
      </div>
      <div style="text-align:right;">
        <div class="money" style="color:#1f6feb;">${formattedAmount}</div>
        <div style="margin-top:2px; font-size:11px;">
          <a href="#" onclick="editTx(${t.id}); return false;" style="color:#1f6feb; margin-right:6px; text-decoration:none;">Edit</a>
          <a href="#" onclick="deleteTx(${t.id}); return false;" style="color:#c0392b; text-decoration:none;">Hapus</a>
        </div>
      </div>
    </div>`;
  }).join("") || '<p class="muted">Belum ada catatan investasi di periode bulan ini.</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

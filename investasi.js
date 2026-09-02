const SUPABASE_URL = "https://hlyzobxyijwndohxwhuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseXpvYnh5aWp3bmRvaHh3aHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjQ5NzksImV4cCI6MjEwMzA0MDk3OX0.4eAwD2XB0OMBaoe0wcXHgi7b42r4B8GC6qV2iU6mTIE";

let sb = null, investments = [];
let usdToIdrRate = 15800; // Default rate estimasi

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const dollar = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const today = new Date();

$("month").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
$("txDate").value = today.toISOString().slice(0, 10);

// Fetch Kurs Dollar Real-time dari API
async function fetchUsdRate() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data && data.rates && data.rates.IDR) {
      usdToIdrRate = data.rates.IDR;
      render(); // Re-render setelah rate didapat
    }
  } catch (e) {
    console.warn("Gagal mengambil kurs online, menggunakan kurs default.", e);
  }
}
fetchUsdRate();

try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.getSession().then(({ data }) => {
    if (data?.session) {
      $("logoutBtn").classList.remove("hidden");
      loadInvestments();
    } else {
      window.location.href = "index.html";
    }
  });
} catch(e) { console.error(e); }

$("logoutBtn").onclick = () => {
  sb.auth.signOut().then(() => window.location.href = "index.html");
};

$("month").onchange = loadInvestments;

$("addBtn").onclick = () => {
  $("txForm").reset();
  $("txId").value = "";
  $("dialogTitle").textContent = "Tambah Investasi";
  $("txDate").value = today.toISOString().slice(0, 10);
  $("txDialog").showModal();
};

$("cancelTx").onclick = () => $("txDialog").close();

$("txForm").onsubmit = async (e) => {
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser();
  const txId = $("txId").value;
  
  const currency = $("txCurrency").value;
  const rawNote = $("txNote").value.trim();
  const cleanNote = rawNote.replace(/^\[(USD|IDR)\]\s*/, "");
  const noteWithCurrency = `[${currency}] ${cleanNote}`;

  const row = {
    user_id: user.id,
    date: $("txDate").value,
    type: "income", 
    amount: Number($("txAmount").value),
    category: $("txCategory").value,
    wallet: "investasi_hilal",
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

  // 1. Filter riwayat transaksi KHUSUS bulan yang dipilih
  const filtered = investments.filter(t => t.date?.slice(0, 7) === month);

  // 2. Variabel total & akumulasi per kategori (hingga bulan yang dipilih)
  let totalIdr = 0;
  let totalUsd = 0;
  const categoryTotals = {}; // Tempat menampung saldo per kategori

  investments.forEach(t => {
    // Hanya hitung transaksi hingga bulan yang dipilih
    if (t.date && t.date.slice(0, 7) <= month) {
      const isUsd = t.note && t.note.includes("[USD]");
      const cat = t.category || "Lainnya";

      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { idr: 0, usd: 0 };
      }

      if (isUsd) {
        totalUsd += t.amount;
        categoryTotals[cat].usd += t.amount;
      } else {
        totalIdr += t.amount;
        categoryTotals[cat].idr += t.amount;
      }
    }
  });

  // Hitung Estimasi Rate PayPal
  const paypalRate = Math.max(0, usdToIdrRate - 600);
  const totalUsdInRupiah = totalUsd * paypalRate;

  // Render Kartu Total
  $("totalIdr").textContent = rupiah(totalIdr);
  $("totalUsd").textContent = dollar(totalUsd);
  
  if ($("totalUsdInIdr")) {
    $("totalUsdInIdr").textContent = `≈ ${rupiah(totalUsdInRupiah)}`;
  }

  if ($("usdRateInfo")) {
    $("usdRateInfo").innerHTML = `Rate USD: ${rupiah(usdToIdrRate)}<br><b style="color:#38bdf8;">Rate PayPal: ${rupiah(paypalRate)}</b>`;
  }

  // --- RENDER KARTU 1: RINCIAN PORTOFOLIO BERKELANJUTAN PER KATEGORI ---
  const catKeys = Object.keys(categoryTotals);
  if (catKeys.length > 0) {
    $("portfolioSummary").innerHTML = catKeys.map(cat => {
      const { idr, usd } = categoryTotals[cat];
      let amountDisplay = [];
      if (idr > 0) amountDisplay.push(rupiah(idr));
      if (usd > 0) amountDisplay.push(dollar(usd));

      return `<div class="tx" style="align-items:center;">
        <div>
          <div class="note"><b>${escapeHtml(cat)}</b></div>
          <div class="meta" style="font-size:11px; color:#64748b; margin-top:2px;">Kategori Portofolio</div>
        </div>
        <div style="text-align:right;">
          <div class="money" style="color:#38bdf8; font-weight:bold;">${amountDisplay.join(" + ") || "Rp0"}</div>
        </div>
      </div>`;
    }).join("");
  } else {
    $("portfolioSummary").innerHTML = '<p class="muted">Belum ada portofolio aset terdaftar.</p>';
  }

  // --- RENDER KARTU 2: RIWAYAT TRANSAKSI BULAN INI ---
  $("transactions").innerHTML = filtered.map(t => {
    const isUsd = t.note && t.note.includes("[USD]");
    const cleanNote = t.note ? t.note.replace("[INVESTASI]", "").replace(/^\[(USD|IDR)\]\s*/, "").replace(/\[(USD|IDR)\]/, "").trim() : t.category;
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
  }).join("") || '<p class="muted">Belum ada transaksi di periode bulan ini.</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

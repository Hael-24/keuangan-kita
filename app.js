const SUPABASE_URL = "https://hlyzobxyijwndohxwhuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseXpvYnh5aWp3bmRvaHh3aHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjQ5NzksImV4cCI6MjEwMzA0MDk3OX0.4eAwD2XB0OMBaoe0wcXHgi7b42r4B8GC6qV2iU6mTIE";

let sb = null, authMode = "login", transactions = [], activePage = "dashboard";
let cashChart = null; // Penampung objek Chart.js
let usdToIdrRate = 15800; // Variable simpan kurs (default)

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const today = new Date();

$("month").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
$("txDate").value = today.toISOString().slice(0, 10);

// Fetch Kurs Dollar Real-time dari API publik
async function fetchUsdRate() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data && data.rates && data.rates.IDR) {
      usdToIdrRate = data.rates.IDR;
      render(); // Re-render jika rate berhasil didapat
    }
  } catch (e) {
    console.warn("Gagal mengambil kurs online, menggunakan kurs estimasi default.", e);
  }
}
fetchUsdRate();

try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.getSession().then(({ data }) => data?.session ? showApp() : showAuth());
  sb.auth.onAuthStateChange((event, session) => session ? showApp() : showAuth());
} catch(e) { console.error(e); }

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

// Navigasi Pindah Halaman aman
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    activePage = e.target.dataset.page;

    if (activePage === "dashboard") {
      $("page-dashboard").classList.remove("hidden");
      $("page-module").classList.add("hidden");
    } else {
      $("page-dashboard").classList.add("hidden");
      $("page-module").classList.remove("hidden");
      const titles = { date: "Keuangan Date", tabungan: "Tabungan", pribadi: "Keuangan Fany" };
      $("moduleTitle").textContent = titles[activePage];
    }
    render();
  };
});

// Switch Tab Login / Daftar
document.querySelectorAll(".tab").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    authMode = b.dataset.mode;
    $("authTitle").textContent = authMode === "login" ? "Masuk" : "Daftar";
    $("authBtn").textContent = authMode === "login" ? "Masuk" : "Buat akun";
    $("authMsg").textContent = "";
  };
});

// Tombol Login / Daftar
$("authBtn").onclick = async () => {
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) return $("authMsg").textContent = "Email dan password wajib diisi.";
  
  $("authMsg").style.color = "#1f6feb";
  $("authMsg").textContent = "Memproses...";

  let res = authMode === "login" 
    ? await sb.auth.signInWithPassword({ email, password }) 
    : await sb.auth.signUp({ email, password });

  if (res.error) {
    $("authMsg").style.color = "#c0392b";
    $("authMsg").textContent = res.error.message;
  } else {
    $("authMsg").style.color = "#16834a";
    $("authMsg").textContent = authMode === "signup" ? "Akun dibuat. Cek email untuk verifikasi." : "Berhasil masuk.";
  }
};

$("logoutBtn").onclick = () => sb.auth.signOut();
$("month").onchange = render;

const walletMap = { date: "bersama", tabungan: "pasangan", pribadi: "hilal" };

$("addBtn").onclick = () => {
  $("txForm").reset();
  $("txId").value = "";
  if (activePage !== "dashboard") $("txWallet").value = walletMap[activePage];
  $("dialogTitle").textContent = "Tambah Transaksi";
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

  let res = txId ? await sb.from("transactions").update(row).eq("id", txId) : await sb.from("transactions").insert(row);
  if (res.error) return alert(res.error.message);
  
  $("txForm").reset();
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
  if (error) return alert("Gagal mengambil data: " + error.message);
  transactions = data || [];
  render();
}

function render() {
  const selectedMonth = $("month").value;

  // 1. Data khusus transaksi bulan yang dipilih (untuk grafik & ringkasan arus kas bulan ini)
  const currentMonthTx = transactions.filter(t => t.date?.slice(0, 7) === selectedMonth);

  // 2. Data kumulatif dari awal hingga bulan yang dipilih (untuk total saldo berkelanjutan)
  const cumulativeTx = transactions.filter(t => t.date?.slice(0, 7) <= selectedMonth);

  // --- KALKULASI TOTAL ASET INVESTASI (KUMULATIF) ---
  const paypalRate = Math.max(0, usdToIdrRate - 500);
  let totalInvIdr = 0;
  let totalInvUsd = 0;

  // Ambil semua transaksi investasi sampai bulan yang dipilih
  transactions.filter(t => t.wallet === "investasi_hilal" && t.date?.slice(0, 7) <= selectedMonth).forEach(t => {
    if (t.note && t.note.includes("[USD]")) {
      totalInvUsd += t.amount;
    } else {
      totalInvIdr += t.amount;
    }
  });

  const totalInvConverted = totalInvIdr + (totalInvUsd * paypalRate);

  if ($("dashNetInvestasi")) {
    $("dashNetInvestasi").textContent = rupiah(totalInvConverted);
  }
  if ($("usdRateInfo")) {
    $("usdRateInfo").innerHTML = `Rate USD: ${rupiah(usdToIdrRate)}<br><b style="color:#38bdf8;">Rate PayPal: ${rupiah(paypalRate)}</b>`;
  }

  // --- KALKULASI ARUS KAS BULAN INI (KHUSUS BULAN YANG DIPILIH) ---
  const sumInc = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const sumExp = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  // --- KALKULASI SALDO BERKELANJUTAN (KUMULATIF SAMPAI BULAN INI) ---
  const calcCumulativeNet = (w) => cumulativeTx.filter(t => t.wallet === w).reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  const netDate = calcCumulativeNet("bersama");
  const netTabungan = calcCumulativeNet("pasangan");
  const netPribadi = calcCumulativeNet("hilal");

  // Total Aset = Total Tabungan Kumulatif + Total Investasi Kumulatif
  const totalInvestasiDanTabungan = netTabungan + totalInvConverted;

  // Tampilkan Nilai ke Tampilan Dashboard
  $("dashTotalNet").textContent = rupiah(totalInvestasiDanTabungan);
  $("dashNetDate").textContent = rupiah(netDate);
  $("dashNetTabungan").textContent = rupiah(netTabungan);
  $("dashNetPribadi").textContent = rupiah(netPribadi);
  if ($("dashCashNet")) {
    $("dashCashNet").textContent = rupiah(netDate + netPribadi);
  }
  $("income").textContent = rupiah(sumInc);
  $("expense").textContent = rupiah(sumExp);
  $("dashTransactions").innerHTML = currentMonthTx.slice(0, 25).map(t => renderTxRow(t)).join("") || '<p class="muted">Belum ada transaksi bulan ini.</p>';

  // --- RENDER MODUL SPESIFIK ---
  if (activePage !== "dashboard") {
    const target = walletMap[activePage];
    
    // 1. Transaksi bulan ini untuk modul (Khusus daftar transaksi & statistik atas)
    const modTxCurrent = currentMonthTx.filter(t => t.wallet === target);
    const inc = modTxCurrent.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = modTxCurrent.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    // 2. Transaksi akumulasi sampai bulan ini untuk kalkulasi per kategori
    const modTxCumulative = cumulativeTx.filter(t => t.wallet === target);

    // Saldo bersih kumulatif untuk modul tersebut
    const modNetCumulative = calcCumulativeNet(target);

    $("modIncome").textContent = rupiah(inc);
    $("modExpense").textContent = rupiah(exp);
    $("modNet").textContent = rupiah(modNetCumulative);
    $("count").textContent = `${modTxCurrent.length} transaksi bulan ini`;

    // 3. Ubah Judul & Hitung Akumulasi per Kategori (Saldo atau Total Tabungan)
    const cats = {};

    if (activePage === "tabungan") {
      if ($("catTitle")) $("catTitle").textContent = "Total Tabungan per Kategori";
      
      // Hitung total akumulasi pemasukan/tabungan per instrumen/kategori
      modTxCumulative.forEach(t => {
        // Jika ada penarikan/pengeluaran tabungan, kurangi nilai akumulasi
        const netVal = t.type === "income" ? t.amount : -t.amount;
        cats[t.category] = (cats[t.category] || 0) + netVal;
      });
    } else {
      if ($("catTitle")) $("catTitle").textContent = "Saldo per Kategori";
      
      // Hitung akumulasi saldo (Pemasukan - Pengeluaran) per kategori dompet
      modTxCumulative.forEach(t => {
        const netVal = t.type === "income" ? t.amount : -t.amount;
        cats[t.category] = (cats[t.category] || 0) + netVal;
      });
    }

    // Cari nilai maksimum positif untuk pembanding lebar bar indikator
    const max = Math.max(...Object.values(cats).map(v => Math.max(v, 0)), 1);

    $("categories").innerHTML = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => 
        `<div class="categoryRow">
          <div class="categoryMeta">
            <span>${escapeHtml(c)}</span>
            <b style="color: ${v < 0 ? '#f87171' : '#38bdf8'};">${rupiah(v)}</b>
          </div>
          <div class="bar">
            <i style="width:${Math.max(0, (v / max) * 100)}%"></i>
          </div>
        </div>`
      ).join("") || '<p class="muted">Belum ada data kategori.</p>';

    // 4. Daftar Transaksi tetap menampilkan transaksi 1 bulan berjalan
    $("transactions").innerHTML = modTxCurrent.map(t => renderTxRow(t)).join("") || '<p class="muted">Belum ada transaksi di modul ini.</p>';
  }

  renderChart(sumInc, sumExp);
}

function renderTxRow(t) {
  return `<div class="tx">
    <div>
      <div class="note">${escapeHtml(t.note || t.category)}</div>
      <div class="meta" style="font-size:11px;color:#8790a2;">${t.date} · ${escapeHtml(t.category)}</div>
    </div>
    <div style="text-align:right;">
      <div class="money ${t.type === "expense" ? "expenseMoney" : "incomeMoney"}">${t.type === "expense" ? "-" : "+"}${rupiah(t.amount)}</div>
      <div style="margin-top:2px;font-size:11px;">
        <a href="#" onclick="editTx(${t.id}); return false;" style="color:#1f6feb;margin-right:6px;">Edit</a>
        <a href="#" onclick="deleteTx(${t.id}); return false;" style="color:#c0392b;">Hapus</a>
      </div>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

// Fungsi Membuat / Update Diagram Pie Arus Kas
function renderChart(income, expense) {
  const ctx = document.getElementById("cashflowChart");
  if (!ctx) return;

  // Hitung persentase sisa/pemasukan tersimpan
  const savedPercent = income > 0 
    ? Math.max(0, Math.round(((income - expense) / income) * 100)) 
    : 0;

  const percentElem = document.getElementById("chartSavingsPercent");
  if (percentElem) {
    percentElem.textContent = `${savedPercent}%`;
    percentElem.style.color = savedPercent < 0 ? "#f87171" : "#4ade80";
  }

  if (cashChart) {
    cashChart.destroy();
  }

  cashChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [{
        data: [income, expense],
        backgroundColor: ["#4ade80", "#f87171"],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#94a3b8",
            font: { size: 11 }
          }
        }
      },
      cutout: "75%" // Membuat lubang tengah sedikit lebih lebar untuk teks
    }
  });
}

// ==========================================
// FUNGSI 1: EXPORT / PRINT LAPORAN BULANAN (PDF)
// ==========================================
window.cetakLaporanBulanan = function() {
  const selectedMonth = $("month").value; // Format "YYYY-MM"
  if (!selectedMonth) return alert("Pilih bulan periode terlebih dahulu!");

  // Filter transaksi bulan ini (Excluding / Kecuali modul 'investasi_hilal')
  const monthTx = transactions.filter(t => 
    t.date?.slice(0, 7) === selectedMonth && t.wallet !== "investasi_hilal"
  );

  if (monthTx.length === 0) {
    return alert(`Tidak ada data transaksi (selain Hilal) pada periode bulan ${selectedMonth}.`);
  }

  // Hitung Total Pemasukan & Pengeluaran Laporan
  const totalInc = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExp = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const sisaSaldo = totalInc - totalExp;

  // Nama Modul / Wallet Map
  const walletNames = { bersama: "Keuangan Date", pasangan: "Tabungan", hilal: "Keuangan Fany" };

  // Buat Konten HTML Khusus Cetak Laporan PDF
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Laporan Keuangan - ${selectedMonth}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0284c7; font-size: 22px; }
        .header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
        .summary-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
        .summary-item { text-align: center; }
        .summary-item span { font-size: 11px; color: #64748b; display: block; }
        .summary-item strong { font-size: 15px; }
        .income { color: #16a34a; }
        .expense { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: right; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KEUANGAN KITA - LAPORAN TRANSAKSI</h1>
        <p>Periode Bulan: <b>${selectedMonth}</b> (Kecuali Investasi Hilal)</p>
      </div>

      <div class="summary-box">
        <div class="summary-item">
          <span>TOTAL PEMASUKAN</span>
          <strong class="income">${rupiah(totalInc)}</strong>
        </div>
        <div class="summary-item">
          <span>TOTAL PENGELUARAN</span>
          <strong class="expense">${rupiah(totalExp)}</strong>
        </div>
        <div class="summary-item">
          <span>SURPLUS / SISA SALDO</span>
          <strong style="color: #0284c7;">${rupiah(sisaSaldo)}</strong>
        </div>
      </div>

      <h3>Daftar Rincian Transaksi (${monthTx.length})</h3>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Modul/Halaman</th>
            <th>Kategori</th>
            <th>Catatan</th>
            <th style="text-align:right;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${monthTx.map((t, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${t.date}</td>
              <td>${walletNames[t.wallet] || t.wallet}</td>
              <td>${escapeHtml(t.category)}</td>
              <td>${escapeHtml(t.note || '-')}</td>
              <td style="text-align:right;" class="${t.type === 'expense' ? 'expense' : 'income'}">
                <b>${t.type === 'expense' ? '-' : '+'}${rupiah(t.amount)}</b>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Dicetak pada: ${new Date().toLocaleString('id-ID')} | Keuangan Kita System
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

// ==========================================
// FUNGSI 2: RESET / HAPUS DATA BULANAN (SUPABASE)
// ==========================================
window.konfirmasiHapusBulanan = async function() {
  const selectedMonth = $("month").value; // Format "YYYY-MM"
  if (!selectedMonth) return alert("Pilih bulan periode terlebih dahulu!");

  // Konfirmasi Tahap 1
  const setuju1 = confirm(
    `⚠️ PERINGATAN BERSAMA!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA transaksi pada bulan [${selectedMonth}]?\n\nCatatan: Seluruh data 'Investasi Hilal' TIDAK AKAN terhapus.`
  );
  if (!setuju1) return;

  // Konfirmasi Tahap 2 (Ketik Kunci Keamanan)
  const setuju2 = prompt(`Ketik kata "HAPUS" untuk mengonfirmasi penghapusan permanen bulan ${selectedMonth}:`);
  if (setuju2 !== "HAPUS") {
    return alert("Penghapusan dibatalkan. Kata konfirmasi tidak sesuai.");
  }

  // Tentukan batas tanggal awal dan akhir bulan
  const startDate = `${selectedMonth}-01`;
  const endDate = `${selectedMonth}-31`;

  try {
    // Eksekusi Hapus ke Supabase Database
    const { error } = await sb
      .from("transactions")
      .delete()
      .gte("date", startDate)
      .lte("date", endDate)
      .neq("wallet", "investasi_hilal"); // Kecuali wallet 'investasi_hilal'

    if (error) {
      alert("Gagal menghapus data dari Supabase: " + error.message);
    } else {
      alert(`Berhasil mereset data transaksi bulan ${selectedMonth} (Data Investasi Hilal tetap aman).`);
      loadTransactions(); // Re-fetch data dari Supabase
    }
  } catch (err) {
    console.error("Error reset data:", err);
    alert("Terjadi kesalahan sistem saat menghapus data.");
  }
};

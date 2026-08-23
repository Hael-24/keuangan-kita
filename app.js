let sb=null, authMode="login", transactions=[];

const $=id=>document.getElementById(id);
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
const today=new Date();
$("month").value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
$("txDate").value=today.toISOString().slice(0,10);

// --- KONFIGURASI OTOMATIS SUPABASE ---
const defaultUrl = "https://hlyzobxyijwndohxwhuo.supabase.co";
const defaultKey = "sb_publishable_eb1wANvveNRCPxXYvnNG7A_L3BDkzYL"; 

connect(defaultUrl, defaultKey);

$("saveConfig").onclick=()=>{const url=$("supabaseUrl").value.trim(),key=$("supabaseKey").value.trim();if(!url||!key)return alert("Isi URL dan key Supabase.");localStorage.setItem("keuangan_config",JSON.stringify({url,key}));connect(url,key)};

function connect(url,key){
  try{sb=window.supabase.createClient(url,key);$("setupCard").classList.add("hidden");$("authCard").classList.remove("hidden");
    sb.auth.getSession().then(({data})=>data.session?showApp():null);
    sb.auth.onAuthStateChange((event,session)=>session?showApp():showAuth());
  }catch(e){alert("Konfigurasi Supabase tidak valid.")}
}
function showAuth(){ $("app").classList.add("hidden");$("logoutBtn").classList.add("hidden");$("authCard").classList.remove("hidden")}
function showApp(){ $("authCard").classList.add("hidden");$("app").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");loadTransactions() }

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");authMode=b.dataset.mode;$("authTitle").textContent=authMode==="login"?"Masuk":"Daftar";$("authBtn").textContent=authMode==="login"?"Masuk":"Buat akun";$("authMsg").textContent=""});

$("authBtn").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||!password)return $("authMsg").textContent="Email dan password wajib diisi.";
 let res=authMode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});
 if(res.error)$("authMsg").textContent=res.error.message;
 else $("authMsg").textContent=authMode==="signup"?"Akun dibuat. Jika diminta, cek email untuk verifikasi.":"Berhasil masuk.";
};
$("logoutBtn").onclick=()=>sb.auth.signOut();
$("month").onchange=loadTransactions;$("walletFilter").onchange=render;

$("addBtn").onclick=()=>$("txDialog").showModal();
$("cancelTx").onclick=()=>$("txDialog").close();

$("txForm").onsubmit=async(e)=>{
 e.preventDefault();
 const {data:{user}}=await sb.auth.getUser();
 const row={user_id:user.id,date:$("txDate").value,type:$("txType").value,amount:Number($("txAmount").value),category:$("txCategory").value,wallet:$("txWallet").value,note:$("txNote").value.trim()};
 const {error}=await sb.from("transactions").insert(row);
 if(error)return alert(error.message);
 $("txForm").reset();$("txDate").value=today.toISOString().slice(0,10);$("txDialog").close();loadTransactions();
};

async function loadTransactions(){
 const {data,error}=await sb.from("transactions").select("*").order("date",{ascending:false}).order("created_at",{ascending:false});
 if(error){console.error(error);return alert("Gagal mengambil data: "+error.message)}
 transactions=data||[];render();
}
function render(){
 const month=$("month").value, wallet=$("walletFilter").value;
 const filtered=transactions.filter(t=>t.date?.slice(0,7)===month&&(wallet==="all"||t.wallet===wallet));
 const income=filtered.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
 const expense=filtered.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
 $("income").textContent=rupiah(income);$("expense").textContent=rupiah(expense);$("net").textContent=rupiah(income-expense);$("count").textContent=`${filtered.length} transaksi`;
 const cats={};filtered.filter(t=>t.type==="expense").forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
 const max=Math.max(...Object.values(cats),1);
 $("categories").innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="categoryRow"><div class="categoryMeta"><span>${escapeHtml(c)}</span><b>${rupiah(v)}</b></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join("")||'<p class="muted">Belum ada pengeluaran.</p>';
 $("transactions").innerHTML=filtered.slice(0,50).map(t=>`<div class="tx"><div><div class="note">${escapeHtml(t.note||t.category)}</div><div class="meta">${t.date} · ${escapeHtml(t.category)} · ${escapeHtml(t.wallet)}</div></div><div class="money ${t.type==="expense"?"expenseMoney":"incomeMoney"}">${t.type==="expense"?"-":"+"}${rupiah(t.amount)}</div></div>`).join("")||'<p class="muted">Belum ada transaksi bulan ini.</p>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
```[cite: 1]

---


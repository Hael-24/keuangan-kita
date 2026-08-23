# Keuangan Kita

Web app pencatatan keuangan sederhana untuk penggunaan pribadi/berdua.

## Fitur versi 1
- Login/register
- Transaksi pemasukan & pengeluaran
- Kategori
- Dompet: Bersama / Hilal / Pasangan
- Filter bulan
- Dashboard pemasukan, pengeluaran, saldo bersih
- Ringkasan pengeluaran per kategori
- Data tersimpan online di Supabase

## Setup
1. Buat project Supabase.
2. Buka SQL Editor lalu jalankan isi `supabase.sql`.
3. Ambil Project URL dan anon/publishable key dari pengaturan API.
4. Upload seluruh file ini ke hosting static gratis seperti Cloudflare Pages, Netlify, atau GitHub Pages.
5. Buka website, masukkan Project URL + key.
6. Daftarkan akun.

## Catatan versi awal
RLS saat ini membuat setiap akun hanya dapat membaca transaksi miliknya sendiri. Untuk mode keuangan bersama yang sebenarnya (akun Hilal + pasangan melihat transaksi yang sama), tambahkan fitur household/member pada versi berikutnya.

Jangan pernah memasukkan service_role key ke website. Gunakan anon/publishable key.

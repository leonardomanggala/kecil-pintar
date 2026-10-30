# Kecil Pintar — latihan TKA SD 2027

Aplikasi ini menggunakan dokumen yang Anda lampirkan sebagai sumber materi dan soal: tiga kerangka asesmen, tiga rangkuman materi, dan sembilan paket soal. Platform memuat 270 soal (90 per mata pelajaran/penguatan), kunci beserta pembahasan, bacaan dan stimulus tabel, kisi-kisi, petunjuk pengerjaan, serta panduan penskoran.

Bahasa Indonesia dan Matematika mengikuti paket yang dilampirkan. Dokumen Paket IPAS menyebut paketnya sebagai draf prediksi/penguatan, bukan kerangka asesmen resmi; catatan ini ditampilkan di halaman utama.

## Buka dan jalankan di VS Code

1. Di VS Code, pilih **File → Open Folder** lalu buka folder `kecil-pintar` ini.
2. Buka **Terminal → New Terminal**.
3. Jalankan `npm run dev`, lalu buka `http://localhost:3000` bila browser tidak terbuka otomatis.

Proyek memakai Vercel Functions untuk endpoint `/api/config`, jadi jalankan dengan Vercel CLI, bukan dengan membuka `index.html` langsung. Jika Vercel CLI belum tersedia, jalankan `npm install --global vercel`. Saat diminta, masuk ke akun Vercel yang memiliki proyek Kecil Pintar.

Konfigurasi lokal berada di `.env.local` dan sudah dikecualikan dari Git. Contoh nama variabel tersedia di `.env.example`. Jangan commit `.env.local`.

## Git dan commit di VS Code

Folder ini sudah disiapkan sebagai repository Git lokal pada branch `main`. Buka ikon **Source Control** di VS Code untuk melihat, memilih, dan commit perubahan. Repository belum memiliki remote GitHub/GitLab; tambahkan remote jika nanti ingin menyimpan atau menyinkronkan repository ke layanan tersebut.

Jika Git meminta identitas commit, atur nama dan email Git yang Anda inginkan di terminal VS Code:

```sh
git config --local user.name "Nama Anda"
git config --local user.email "email-git-anda@example.com"
```

## Akun Login dan Register

Halaman login/register menjadi gerbang awal sebelum dashboard, materi, atau latihan dapat dibuka. Daftar dan masuk menggunakan email wali/orang tua dan kata sandi melalui Supabase Auth. Progres perangkat ditautkan ke ID akun dan disimpan per pengguna di Supabase; kebijakan RLS membatasi data ke pemilik akun.

Di Supabase, pastikan **Email** aktif di **Authentication → Sign In / Providers**. Pada proyek hosted, konfirmasi email biasanya aktif secara default. Tetapkan **Site URL** ke URL Vercel dan tambahkan URL produksi serta preview yang diperlukan di **Redirect URLs**. Jika konfirmasi email aktif, pendaftar mengikuti tautan konfirmasi yang dikirim Supabase sebelum masuk. Layanan email bawaan memiliki batas pengiriman; atur SMTP sendiri untuk penggunaan produksi.

## Menyiapkan Supabase

1. Buat proyek Supabase.
2. Pastikan provider Email aktif; anonymous sign-in tidak digunakan.
3. Buka **SQL Editor**, lalu jalankan seluruh isi `supabase/schema.sql`.
4. Catat **Project URL** dan **publishable/anon key** dari pengaturan API proyek. Jangan gunakan `service_role` key di browser atau Vercel untuk aplikasi ini.

## Deploy ke Vercel

Situs sudah online di [kecil-pintar-tka.vercel.app](https://kecil-pintar-tka.vercel.app). Environment production terhubung ke Supabase. Untuk deployment otomatis dari Git, hubungkan repository remote ke proyek Vercel `kecil-pintar-tka` dan pertahankan `SUPABASE_URL` serta `SUPABASE_ANON_KEY` sebagai environment variables di Vercel.

## Isi platform

- Tiga mata pelajaran/penguatan dengan tiga paket masing-masing; tiap paket berisi 30 soal dan durasi 75 menit sesuai keterangan dokumen.
- Pilihan tunggal, pilihan lebih dari satu, dan soal kategori seperti Benar/Salah atau Fakta/Opini.
- Nilai parsial 0,5 mengikuti ketentuan pedoman penskoran paket.
- Bacaan dan tabel stimulus, kunci, pembahasan, kisi-kisi, petunjuk, dan panduan penskoran.
- Rangkuman materi dan kerangka asesmen untuk Bahasa Indonesia, IPAS, dan Matematika; dua ilustrasi dari kerangka IPAS ikut dimuat.

## Catatan akun

Gunakan email wali/orang tua dan hindari memasukkan data pribadi anak yang tidak diperlukan. Akun dapat digunakan untuk masuk kembali dari perangkat lain. Alur pemulihan kata sandi belum disediakan di halaman ini.

Dokumentasi resmi Supabase: [Email dan kata sandi](https://supabase.com/docs/guides/auth/passwords), [signUp](https://supabase.com/docs/reference/javascript/auth-signup), [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

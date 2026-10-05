# ROADMAP.md — Warzone Strike

Urutan pengerjaan. Kerjakan **satu fase per waktu**. Jangan mulai fase berikutnya sebelum fase saat ini terverifikasi (definisi verifikasi ada di `AGENTS.md` bagian 5). Detail fitur ada di `GAME_SPEC.md`.

Prioritas umum:

```text
Gameplay/Logic → Arsitektur → Stabilitas → Balancing → Asset/Animasi → VFX/Audio → UI polish → Leaderboard resmi → Desktop packaging
```

Setiap fase diakhiri dengan: `npm run build` lolos, `npm run dev` tanpa error console, checklist acceptance dijalankan manual, lalu commit.

---

## Phase 1 — Project Setup (mulai dari sini)

**Target:** Vite + TypeScript (strict) + Three.js (versi di-pin), renderer, camera, lighting dasar, arena placeholder dari primitive geometry (ground, wall, box, container).

**Acceptance:**
- [ ] `npm install` dan `npm run dev` berhasil
- [ ] Halaman browser menampilkan arena 3D sederhana
- [ ] Tidak ada fatal runtime error
- [ ] `npm run build` lolos
- [ ] Resize window tidak merusak tampilan
- [ ] Tidak ada request ke CDN/URL eksternal saat runtime (semua di-bundle Vite); game tetap tampil dengan jaringan dimatikan setelah halaman dimuat

**Jangan dikerjakan di fase ini:** sniper, knife, enemy, wave, boss, leaderboard, MySQL, login, backend, desktop packaging, asset final, dependency tambahan.

---

## Phase 2 — Player, Health Dasar, HUD Minimal

**Target:** FPS controller (WASD, mouse look via Pointer Lock), delta time, collision AABB dasar, starting position, `PlayerHealth` (nilai dan fungsi damage saja), HUD minimal (health; slot ammo disiapkan), pause via `pointerlockchange`, jump opsional.

**Acceptance:**
- [ ] Gerakan stabil dan tidak bergantung FPS
- [ ] Kamera bekerja dan sensitivity dapat diatur
- [ ] Pemain tidak menembus dinding/obstacle dasar dan bisa sliding di dinding
- [ ] Esc / kehilangan pointer lock memunculkan pause; resume berfungsi
- [ ] Klik kanan tidak memunculkan menu konteks browser
- [ ] Health pemain tampil di HUD dan dapat dikurangi (uji lewat tombol debug sementara)

---

## Phase 3 — Sniper

**Target:** sniper placeholder, fire (interval), raycast ke enemy + obstacle (hit terdekat), ammo, reload, scope + zoom, hitbox head/body dengan headshot, pencatatan `shotsFired`/`shotsHit`, target dummy sederhana untuk pengujian, ammo di HUD.

**Acceptance:**
- [ ] Sniper menembak sesuai fire interval
- [ ] Ammo berkurang; reload berfungsi dan tidak bisa menembak saat reload
- [ ] Scope dan zoom bekerja (FOV, overlay, sensitivity)
- [ ] Peluru tidak menembus dinding
- [ ] Target dummy menerima damage; headshot memberi damage lebih besar
- [ ] `shotsFired` dan `shotsHit` tercatat benar

---

## Phase 4 — Knife

**Target:** knife placeholder, attack dengan cooldown, short-range hit detection, weapon switching (1, 2, scroll).

**Acceptance:**
- [ ] Switching sniper ↔ knife bekerja (tombol dan scroll)
- [ ] Knife mengenai target dalam range dan tidak di luar range
- [ ] Cooldown knife bekerja
- [ ] Sniper tetap berfungsi normal (ammo, reload, scope) setelah switching
- [ ] Switching saat reload atau scope tidak meninggalkan state rusak

---

## Phase 5 — Enemy

**Target:** enemy placeholder (body + head hitbox), mengejar pemain, melee attack dengan cooldown ke `PlayerHealth`, health, death.

**Acceptance:**
- [x] Enemy mendekati pemain
- [x] Enemy menyerang dalam range dan health pemain berkurang
- [x] Enemy menerima damage dari sniper dan knife, termasuk headshot
- [x] Enemy mati dan dibersihkan dari scene (tanpa memory leak jelas)
- [x] Enemy tidak menembus dinding

---

## Phase 6 — Wave

**Target:** `SpawnManager`, `WaveManager`, intermission, scaling jumlah/HP/damage, batas enemy aktif, `minSpawnDistance`, semua nilai dari config.

**Acceptance:**
- [x] Wave dimulai, enemy di-generate sesuai config
- [x] Wave berakhir saat semua enemy mati; wave berikutnya mulai setelah intermission
- [x] Wave berlanjut tanpa batas
- [x] Tidak ada enemy spawn lebih dekat dari `minSpawnDistance`
- [x] Enemy aktif tidak melebihi batas
- [x] Difficulty naik terkontrol; nilai bisa diubah dari config tanpa menyentuh logic

---

## Phase 7 — Boss

**Target:** boss dari enemy placeholder, spawn di wave kelipatan 5 setelah enemy biasa habis, scaling HP dan ukuran, size cap.

**Acceptance:**
- [x] Boss muncul di wave 5, 10, 15, dst.
- [x] Boss muncul hanya setelah enemy biasa wave itu mati
- [x] HP dan ukuran naik tiap kemunculan; ukuran tidak melewati cap
- [x] Setelah boss mati: intermission lalu wave berikutnya

---

## Phase 8 — Score dan Game Flow

**Target:** `ScoreManager` (kill, headshot bonus, boss kill), pencatatan statistik sesi (kills, headshots, bossesKilled, accuracy, durasi, wave), game over saat health habis, `GameState`, main menu, pause menu, game over screen, HUD lengkap (health, ammo, wave, score), tombol retry/main lagi.

**Acceptance:**
- [x] Score bertambah sesuai event
- [x] Health habis → game over tampil dan game berhenti
- [x] State machine berpindah benar (MENU → PLAYING → PAUSED/GAME_OVER)
- [x] Data akhir sesi (semua field payload) dapat dikumpulkan
- [x] Memulai game baru mereset state dengan bersih (tanpa sisa enemy/score/timer lama)
- [x] Game Over screen dan tombol main lagi berfungsi tanpa bergantung pada jaringan atau hasil submission

---

## Phase 9 — Mock Leaderboard

**Target:** `PlayerIdentityProvider` + `MockPlayerIdentityProvider`, `LeaderboardClient` + `MockLeaderboardClient` (dengan mode simulasi: sukses, gagal, timeout, offline/reconnect), `ScorePayload`, `sessionId` (UUID), `ScoreSubmissionQueue` (localStorage sebagai solusi MVP, dapat diganti IndexedDB), timeout submission, tombol Retry manual + retry otomatis sekali saat game dibuka (detail retry boleh disesuaikan), state `SUBMITTING_SCORE` / `SCORE_SUBMITTED`. Score selalu disimpan lokal sebelum submission dicoba.

**Acceptance:**
- [x] Payload dibuat dari data sesi dengan semua field terisi
- [x] `sessionId` unik per sesi
- [x] Mock submission berjalan dan bisa disimulasikan gagal
- [x] Submission gagal tetap ada di queue (bertahan setelah refresh halaman)
- [x] Retry berhasil mengosongkan item dari queue
- [x] `sessionId` yang sama tidak terkirim dua kali
- [x] Score tersimpan lokal **sebelum** submission dicoba (uji: paksa gagal, refresh halaman, item masih ada)
- [x] **API mati:** game tetap dapat dimulai, dimainkan, dan mencapai Game Over; score akhir tampil; item masuk queue tanpa error fatal
- [x] **Timeout:** submission berhenti setelah batas waktu, UI tidak menggantung, item tetap di queue, pemain dapat main lagi
- [x] **Reconnect / API pulih:** retry (manual, otomatis saat game dibuka, atau saat event `online`) berhasil mengirim item dan mengosongkan queue
- [x] Game dapat dimainkan dari Main Menu sampai Game Over dengan jaringan dimatikan (DevTools offline)
- [x] Kegagalan penulisan storage (mis. quota penuh) tidak membuat game crash

---

## Phase 10 — Visual dan Audio Polish

Baru setelah gameplay inti stabil dan diuji: animasi, VFX, muzzle flash, hit feedback, audio, scope presentation, polish environment dan UI. Jangan mengubah kontrak gameplay demi kebutuhan visual kecuali benar-benar perlu.

**Keputusan:** visual prosedural (primitive geometry + material Three.js) diterima sebagai hasil akhir. Asset GLB/GLTF tidak dipakai. Audio disintesis penuh lewat Web Audio API (tanpa file audio). Karena itu tidak ada entri asset eksternal di `CREDITS.md`.

**Status implementasi (diperiksa dari kode):**
- [x] Audio SFX + BGM adaptif (`AudioManager.ts`), mute `M`
- [x] Muzzle flash Sniper dan AssaultRifle; efek ledakan Bazooka dan Granat
- [x] Hit feedback: hitmarker biasa/headshot, damage vignette, hit flash emissive musuh
- [x] Animasi prosedural: serangan/jalan/mati musuh, recoil Bazooka, tebasan Knife, head-bob kamera
- [x] Scope overlay, fog, bayangan, HUD lengkap, modal supply

**Acceptance (wajib diuji manual di browser, lihat `AGENTS.md` bagian 5):**
- [ ] `npm run build` lolos tanpa error TypeScript
- [ ] `npm run dev` berjalan, console browser tanpa error
- [ ] Semua acceptance fase 2–9 masih lulus
- [ ] Acceptance Supply Crate dan Senjata Tambahan (di bawah) lulus
- [ ] Frame rate tetap wajar (catat FPS rata-rata dan terendah di wave 10 dan wave boss)

### Acceptance tambahan — Supply Crate, Upgrade, Senjata Tambahan (`GAME_SPEC.md` 15a)
- [ ] Crate muncul setelah wave selesai dan hilang bila intermission habis tanpa dibuka
- [ ] Hitung mundur intermission berhenti selama menu supply terbuka
- [ ] Jumlah pilihan sesuai wave: 1 (wave 1-4), 2 (wave 5-9), 3 (wave 10+)
- [ ] Upgrade Reload/Damage/Max HP bertumpuk sampai batas maksimum lalu tidak muncul lagi; boss wave memberi 2 step
- [ ] Mengambil senapan/sniper baru menggantikan senjata utama dan langsung dipegang
- [ ] Amunisi, granat (`G`), upgrade, dan loadout ter-reset bersih saat run baru
- [ ] Pergantian senjata saat reload, scope, atau lempar granat tidak meninggalkan state rusak

### Laporan hasil uji Fase 10
Isi per butir: lulus / gagal / tidak dapat diuji. Jangan menulis "sudah dites" tanpa menjalankannya (Rule 13).

| Butir | Hasil | Catatan |
|---|---|---|
| Build | | |
| Dev server + console | | |
| Fase 2–9 regresi | | |
| Supply/senjata tambahan | | |
| FPS wave 10 (avg / min) | | |
| FPS wave boss (avg / min) | | |

**Opsional (tidak menghalangi penutupan fase, hanya visual, jangan ubah logic raycast):** muzzle flash/back-blast Bazooka, tracer peluru dan impact dinding Sniper.

---

## Phase 11 — Leaderboard Resmi

**Hanya dikerjakan setelah panitia memberikan spesifikasi resmi.** Data yang dibutuhkan sebelum mulai:

- endpoint resmi dan HTTP method
- metode autentikasi
- mekanisme identitas pemain dan sumber player ID resmi
- request schema dan response schema
- aturan duplicate submission
- perilaku error
- rate limit (jika ada)

Ketiadaan spesifikasi ini **tidak memblokir** fase 1–10 maupun 12. Sampai lengkap: **tetap pakai mock.** Implementasi resmi = `OfficialLeaderboardClient` + provider identitas resmi, tanpa mengubah gameplay.

---

## Phase 12 — Desktop Packaging

Setelah versi browser stabil dan diuji. Baru putuskan Tauri atau Electron, build configuration, packaging, dan penyesuaian khusus desktop bila perlu.

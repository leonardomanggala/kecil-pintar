let appData = JSON.parse(document.getElementById('tka-data').textContent);
const subjects = appData.subjects;
const packages = appData.packages;
const subjectStyles = {
    indonesia: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', button: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: 'book-open' },
    ipas: { color: 'bg-amber-50 text-amber-700 border-amber-200', button: 'bg-amber-500 hover:bg-amber-600 text-white', icon: 'flask-conical' },
    matematika: { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', button: 'bg-indigo-600 hover:bg-indigo-700 text-white', icon: 'calculator' }
};

function createInitialUserState() {
    return {
        coins: 0, level: 1, xp: 0, completedCount: 0,
        badgesUnlocked: [
        { id: 'b1', title: 'Pemula Hebat', desc: 'Menyelesaikan latihan pertama', icon: 'award', unlocked: false },
        { id: 'b2', title: 'Ahli Hitung', desc: 'Nilai sempurna Matematika', icon: 'calculator', unlocked: false },
        { id: 'b3', title: 'Pembaca Teliti', desc: 'Menyelesaikan Bahasa Indonesia', icon: 'book-open', unlocked: false },
        { id: 'b4', title: 'Ilmuwan Muda', desc: 'Menyelesaikan paket IPAS', icon: 'flask-conical', unlocked: false },
        { id: 'b5', title: 'Kolektor Koin', desc: 'Kumpulkan 500 koin', icon: 'coins', unlocked: false },
        { id: 'b6', title: 'Bintang TKA', desc: 'Selesaikan latihan tiga mapel', icon: 'trophy', unlocked: false },
        { id: 'b7', title: 'Rajin Berlatih', desc: 'Kerjakan 60 soal', icon: 'flame', unlocked: false },
        { id: 'b8', title: 'Jenius TKA', desc: 'Capai Level 5', icon: 'sparkles', unlocked: false }
        ]
    };
}
let userState = createInitialUserState();

let currentQuiz = {
    categoryId: null, packageId: null, packageNumber: null, questions: [], currentIndex: 0,
    points: 0, correctCount: 0, incorrectCount: 0, partialCount: 0, answeredCount: 0,
    answered: false, selected: null, remainingSeconds: 75 * 60, timerInterval: null, finished: false
};
let supabaseClient = null;
let currentUserId = null;
let currentAccountEmail = '';
let currentProgressStorageKey = null;
let authMode = 'login';
let activeReferenceSubject = 'indonesia';
let activeReferenceKind = 'summary';
const progressStorageKey = 'kecil-pintar-progress-v2';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function richText(text, extraClass = '') {
    const pieces = String(text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    return pieces.map(piece => {
        const lines = piece.split('\n').map(x => x.trim()).filter(Boolean);
        const rows = lines.map(line => line.split(/\s*\|\s*/));
        if (rows.length > 1 && rows.every(row => row.length > 1)) {
            return `<div class="overflow-x-auto my-3"><table class="min-w-full border-collapse text-sm"><tbody>${rows.map((row, i) => `<tr class="${i === 0 ? 'bg-indigo-100 font-semibold text-slate-800' : 'bg-white'}">${row.map(cell => `<td class="border border-slate-200 px-3 py-2 align-top">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        }
        const safe = lines.map(escapeHtml).join('<br>');
        const looksLikeHeading = piece.length < 100 && !/[.!?]$/.test(piece) && !piece.includes('\n');
        return looksLikeHeading
            ? `<h3 class="reference-heading">${safe}</h3>`
            : `<p class="reference-paragraph ${extraClass}">${safe}</p>`;
    }).join('');
}

async function initializeApp() {
    try {
        const response = await fetch('/api/config');
        if (response.ok && window.supabase) {
            const config = await response.json();
            if (config.supabaseUrl && config.supabaseAnonKey) {
                supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (error) throw error;
                if (session?.user && !session.user.is_anonymous) await enterApp(session.user);
                else {
                    if (session?.user?.is_anonymous) await supabaseClient.auth.signOut();
                    showAuthScreen(false);
                }
            } else {
                showAuthScreen(true);
            }
        } else showAuthScreen(true);
    } catch (error) {
        showAuthScreen(true, 'Koneksi ke Supabase belum tersedia. Periksa pengaturan Vercel dan coba muat ulang halaman.');
    }
    lucide.createIcons();
}

function showAuthScreen(needsSetup = false, message = '') {
    currentUserId = null;
    currentAccountEmail = '';
    currentProgressStorageKey = null;
    document.getElementById('member-controls').classList.add('hidden');
    ['dashboard', 'quiz', 'result'].forEach(name => document.getElementById(`view-${name}`).classList.add('hidden'));
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('auth-setup-notice').classList.toggle('hidden', !needsSetup);
    setAuthMode(authMode);
    if (message) setAuthMessage(message, 'error');
}

async function enterApp(user) {
    if (!user || user.is_anonymous) return showAuthScreen(false);
    currentUserId = user.id;
    currentAccountEmail = user.email || '';
    const displayName = String(user.user_metadata?.username || user.user_metadata?.full_name || '').trim();
    currentProgressStorageKey = `${progressStorageKey}:${currentUserId}`;
    document.getElementById('user-email').innerText = currentAccountEmail;
    document.getElementById('settings-username').value = displayName;
    document.getElementById('settings-email').value = currentAccountEmail;
    document.getElementById('welcome-title').innerText = displayName ? `Halo, ${displayName}! ✨` : 'Halo, Bintang Kecil! ✨';
    document.getElementById('member-controls').classList.remove('hidden');
    document.getElementById('view-auth').classList.add('hidden');
    userState = createInitialUserState();
    const saved = localStorage.getItem(currentProgressStorageKey);
    if (saved) {
        try { userState = { ...userState, ...JSON.parse(saved) }; } catch (_) {}
    }
    const { data, error } = await supabaseClient.from('user_progress').select('*').eq('user_id', currentUserId).maybeSingle();
    if (error) console.error('Gagal memuat progres:', error.message);
    if (data) {
        userState = { ...userState, coins: data.coins, level: data.level, xp: data.xp, completedCount: data.completed_count, badgesUnlocked: data.badges };
        localStorage.setItem(currentProgressStorageKey, JSON.stringify(userState));
    }
    renderDashboard();
    renderReferences();
    switchView('dashboard');
}

function setAuthMessage(message = '', kind = 'info') {
    const box = document.getElementById('auth-message');
    box.innerText = message;
    box.className = `rounded-xl border p-3 text-sm leading-5 ${kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`;
    box.classList.toggle('hidden', !message);
}

function setAuthMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    const registering = authMode === 'register';
    document.getElementById('auth-confirm-wrap').classList.toggle('hidden', !registering);
    document.getElementById('auth-confirm-password').required = registering;
    document.getElementById('auth-password').autocomplete = registering ? 'new-password' : 'current-password';
    document.getElementById('auth-submit').innerText = registering ? 'Buat Akun' : 'Masuk';
    document.getElementById('auth-login-tab').className = `rounded-lg py-2.5 text-sm font-semibold ${!registering ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`;
    document.getElementById('auth-register-tab').className = `rounded-lg py-2.5 text-sm font-semibold ${registering ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`;
    setAuthMessage('');
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return setAuthMessage('Supabase belum dikonfigurasi. Hubungkan proyek Supabase dan tambahkan URL serta publishable key ke Vercel.', 'error');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submit = document.getElementById('auth-submit');
    if (authMode === 'register' && password !== document.getElementById('auth-confirm-password').value) return setAuthMessage('Kata sandi dan konfirmasinya belum sama.', 'error');
    submit.disabled = true;
    submit.classList.add('opacity-60');
    setAuthMessage(authMode === 'register' ? 'Membuat akun…' : 'Memeriksa akun…');
    try {
        if (authMode === 'register') {
            const redirectTo = ['localhost', '127.0.0.1'].includes(window.location.hostname)
                ? 'https://kecil-pintar-tka.vercel.app/'
                : window.location.origin;
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: redirectTo }
            });
            if (error) throw error;
            if (data.session && data.user) await enterApp(data.user);
            else setAuthMessage('Akun berhasil dibuat. Buka email untuk mengonfirmasi pendaftaran, lalu kembali dan masuk.', 'success');
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await enterApp(data.user);
        }
    } catch (error) {
        setAuthMessage(authErrorMessage(error), 'error');
    } finally {
        submit.disabled = false;
        submit.classList.remove('opacity-60');
    }
}

function authErrorMessage(error) {
    const text = String(error?.message || '').toLowerCase();
    if (text.includes('invalid login credentials')) return 'Email atau kata sandi belum cocok.';
    if (text.includes('password should be at least')) return 'Kata sandi harus lebih panjang.';
    if (text.includes('email not confirmed')) return 'Konfirmasi email terlebih dahulu, lalu masuk kembali.';
    if (text.includes('user already registered')) return 'Email ini sudah terdaftar. Pilih Masuk.';
    return error?.message || 'Ada kendala. Silakan coba lagi.';
}

async function signOut() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    clearInterval(currentQuiz.timerInterval);
    userState = createInitialUserState();
    currentQuiz = { ...currentQuiz, timerInterval: null, finished: true };
    showAuthScreen(false);
    setAuthMessage('Anda sudah keluar dari akun.', 'success');
}

function setSettingsMessage(id, message = '', kind = 'success') {
    const box = document.getElementById(id);
    box.innerText = message;
    box.className = `rounded-xl border p-3 text-sm leading-5 ${kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`;
    box.classList.toggle('hidden', !message);
}

async function withSettingsSubmit(buttonId, messageId, message, action) {
    const button = document.getElementById(buttonId);
    button.disabled = true;
    button.classList.add('opacity-60');
    setSettingsMessage(messageId, message);
    try {
        await action();
    } catch (error) {
        setSettingsMessage(messageId, authErrorMessage(error), 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('opacity-60');
    }
}

async function saveProfileSettings(event) {
    event.preventDefault();
    if (!supabaseClient || !currentUserId) return setSettingsMessage('profile-message', 'Silakan masuk kembali untuk mengubah profil.', 'error');
    const username = document.getElementById('settings-username').value.trim();
    if (!username) return setSettingsMessage('profile-message', 'Nama pengguna tidak boleh kosong.', 'error');
    await withSettingsSubmit('profile-submit', 'profile-message', 'Menyimpan nama…', async () => {
        const { data, error } = await supabaseClient.auth.updateUser({ data: { username } });
        if (error) throw error;
        document.getElementById('welcome-title').innerText = `Halo, ${username}! ✨`;
        setSettingsMessage('profile-message', 'Nama pengguna berhasil diperbarui.');
    });
}

async function saveEmailSettings(event) {
    event.preventDefault();
    if (!supabaseClient || !currentUserId) return setSettingsMessage('email-message', 'Silakan masuk kembali untuk mengubah email.', 'error');
    const email = document.getElementById('settings-email').value.trim();
    if (!email || email.toLowerCase() === currentAccountEmail.toLowerCase()) return setSettingsMessage('email-message', 'Masukkan alamat email baru yang berbeda dari email saat ini.', 'error');
    await withSettingsSubmit('email-submit', 'email-message', 'Memperbarui email…', async () => {
        const { error } = await supabaseClient.auth.updateUser({ email });
        if (error) throw error;
        setSettingsMessage('email-message', 'Tautan konfirmasi telah dikirim. Perubahan email berlaku setelah Anda mengonfirmasinya.');
    });
}

async function savePasswordSettings(event) {
    event.preventDefault();
    if (!supabaseClient || !currentUserId) return setSettingsMessage('password-message', 'Silakan masuk kembali untuk mengubah kata sandi.', 'error');
    const currentPassword = document.getElementById('settings-current-password').value;
    const newPassword = document.getElementById('settings-new-password').value;
    const confirmation = document.getElementById('settings-confirm-password').value;
    if (newPassword.length < 8) return setSettingsMessage('password-message', 'Kata sandi baru minimal 8 karakter.', 'error');
    if (newPassword !== confirmation) return setSettingsMessage('password-message', 'Kata sandi baru dan konfirmasinya belum sama.', 'error');
    await withSettingsSubmit('password-submit', 'password-message', 'Memverifikasi kata sandi…', async () => {
        const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email: currentAccountEmail, password: currentPassword });
        if (verifyError) throw verifyError;
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;
        document.getElementById('password-form').reset();
        setSettingsMessage('password-message', 'Kata sandi berhasil diganti.');
    });
}

function saveLocalProgress() {
    if (currentProgressStorageKey) localStorage.setItem(currentProgressStorageKey, JSON.stringify(userState));
}

async function persistProgress() {
    saveLocalProgress();
    if (!supabaseClient || !currentUserId) return;
    const progress = {
        user_id: currentUserId, coins: userState.coins, level: userState.level,
        xp: userState.xp, completed_count: userState.completedCount,
        badges: userState.badgesUnlocked, updated_at: new Date().toISOString()
    };
    const { error: saveError } = await supabaseClient.from('user_progress').upsert(progress);
    if (saveError) console.error('Gagal menyimpan progres:', saveError.message);
    const grade = Math.round((currentQuiz.points / currentQuiz.questions.length) * 10000) / 100;
    const { error: attemptError } = await supabaseClient.from('quiz_attempts').insert({
        user_id: currentUserId, category_id: currentQuiz.categoryId,
        package_number: currentQuiz.packageNumber, score: grade,
        correct_count: currentQuiz.correctCount, incorrect_count: currentQuiz.incorrectCount,
        partial_count: currentQuiz.partialCount, question_count: currentQuiz.questions.length, coins_earned: 50
    });
    if (attemptError) console.error('Gagal mencatat latihan:', attemptError.message);
}

function switchView(viewName) {
    if (!currentUserId) { showAuthScreen(!supabaseClient); return; }
    ['dashboard', 'settings', 'quiz', 'result'].forEach(name => document.getElementById(`view-${name}`).classList.toggle('hidden', name !== viewName));
    if (viewName === 'dashboard') renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
}

function packageDetailsMarkup(item) {
    const info = Object.entries(item.packageInfo || {});
    const infoTable = info.length ? `<div class="overflow-x-auto my-2"><table class="w-full text-xs"><tbody>${info.map(([key, value]) => `<tr><th class="text-left p-2 border border-slate-200 bg-slate-100">${escapeHtml(key)}</th><td class="p-2 border border-slate-200">${escapeHtml(value)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const note = (item.packageNote || []).length ? `<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">${(item.packageNote || []).map(escapeHtml).join('<br><br>')}</div>` : '';
    const instructions = (item.instructions || []).length ? `<h4 class="font-semibold mt-3">Petunjuk</h4><ol class="list-decimal pl-5 space-y-1">${item.instructions.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ol>` : '';
    const rows = item.blueprint || [];
    const blueprint = rows.length ? `<details class="mt-3"><summary class="cursor-pointer font-semibold">Lihat kisi-kisi per butir</summary><div class="overflow-x-auto mt-2"><table class="min-w-full border-collapse text-[11px]"><tbody>${rows.map((row, index) => `<tr class="${index === 0 ? 'bg-indigo-100 font-semibold' : 'bg-white'}">${row.map(cell => `<td class="border border-slate-200 px-2 py-1.5 align-top">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : '';
    const scoring = (item.scoringGuide || []).length ? `<details class="mt-3"><summary class="cursor-pointer font-semibold">Panduan penskoran</summary><div class="mt-2">${richText(item.scoringGuide.join('\n\n'))}</div></details>` : '';
    return `<details class="mt-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:text-xs leading-5"><summary class="cursor-pointer break-words font-semibold text-slate-700">Rincian, petunjuk, dan kisi-kisi Paket ${item.package}</summary><div class="min-w-0 pt-2 break-words">${note}${infoTable}${instructions}${blueprint}${scoring}<p class="text-[10px] text-muted-foreground mt-3">Sumber: ${escapeHtml(item.source)}</p></div></details>`;
}

function renderDashboard() {
    document.getElementById('header-coins').innerText = userState.coins;
    document.getElementById('header-level').innerText = `Level ${userState.level}`;
    document.getElementById('xp-text').innerText = `${userState.xp} / 100 XP`;
    document.getElementById('xp-progress-bar').style.width = `${userState.xp}%`;
    document.getElementById('stat-completed').innerText = userState.completedCount;
    const unlocked = userState.badgesUnlocked.filter(b => b.unlocked).length;
    document.getElementById('stat-badges').innerText = `${unlocked} / ${userState.badgesUnlocked.length}`;

    const grid = document.getElementById('category-grid');
    grid.innerHTML = subjects.map(subject => {
        const style = subjectStyles[subject.id];
        const subjectPackages = packages.filter(item => item.subject === subject.id);
        const displayName = subject.id === 'ipas' ? 'Penguatan IPAS' : subject.name;
        const importantNote = (subjectPackages[0]?.packageNote || []).map(escapeHtml).join('<br><br>');
        const noticeText = importantNote || 'Paket ini mencakup bilangan, aljabar, pengukuran, geometri, analisis data, dan peluang. Setiap latihan berisi 30 soal dengan waktu 75 menit. Baca soal dengan teliti dan periksa kembali satuan serta langkah hitungmu.';
        const notice = `<div class="min-h-[140px] sm:min-h-[160px] lg:min-h-[180px] rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">${noticeText}</div>`;
        return `<article class="shadcn-card h-full min-w-0 p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
            <div class="min-h-[110px] sm:min-h-[120px]"><div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${style.color} flex items-center justify-center mb-3 border"><i data-lucide="${style.icon}" class="w-6 h-6"></i></div>
            <h3 class="font-display font-bold text-lg text-slate-800">${escapeHtml(displayName)}</h3>
            <p class="text-xs text-muted-foreground mt-1 leading-5">${subjectPackages.length} paket sesuai dokumen · 30 soal per paket · 75 menit</p></div>
            ${notice}
            <div class="grid grid-cols-3 gap-2 mt-auto">${subjectPackages.map(item => `<button onclick="startQuiz('${item.id}')" class="${style.button} min-w-0 rounded-lg px-1.5 sm:px-2 py-2.5 text-[11px] sm:text-xs font-semibold leading-tight transition">Paket ${item.package}<span class="block mt-0.5 text-[10px] font-normal opacity-85">30 soal</span></button>`).join('')}</div>
            <div class="space-y-2">${subjectPackages.map(packageDetailsMarkup).join('')}</div>
        </article>`;
    }).join('');

    const badgeContainer = document.getElementById('badges-container');
    badgeContainer.innerHTML = userState.badgesUnlocked.map(badge => `<div class="p-3 rounded-xl border ${badge.unlocked ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'} flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl ${badge.unlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'} flex items-center justify-center shrink-0"><i data-lucide="${escapeHtml(badge.icon)}" class="w-5 h-5"></i></div>
        <div class="overflow-hidden"><h4 class="font-display font-bold text-xs text-slate-800 truncate">${escapeHtml(badge.title)}</h4><p class="text-[10px] text-muted-foreground truncate">${escapeHtml(badge.desc)}</p></div></div>`).join('');
    lucide.createIcons();
}

function renderReferences() {
    const controls = document.getElementById('reference-subjects');
    controls.innerHTML = subjects.map(subject => `<button onclick="setReferenceSubject('${subject.id}')" class="px-3 py-2 rounded-lg text-sm font-semibold transition ${activeReferenceSubject === subject.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${escapeHtml(subject.name)}</button>`).join('');
    document.getElementById('reference-summary-button').className = `px-4 py-2 rounded-lg text-sm font-semibold ${activeReferenceKind === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`;
    document.getElementById('reference-framework-button').className = `px-4 py-2 rounded-lg text-sm font-semibold ${activeReferenceKind === 'framework' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`;
    const ref = appData.references.find(item => item.subject === activeReferenceSubject && item.kind === activeReferenceKind);
    const container = document.getElementById('reference-content');
    if (!ref) { container.innerHTML = '<p>Dokumen tidak ditemukan.</p>'; return; }
    let html = `<p class="reference-source">Sumber: ${escapeHtml(ref.source)}</p><div class="reference-prose">${richText(ref.content)}</div>`;
    if (activeReferenceSubject === 'ipas' && activeReferenceKind === 'framework') {
        html += `<figure class="mt-6"><img class="max-w-full rounded-xl border border-slate-200 bg-white" src="data/assets/ipas-struktur-tumbuhan.jpeg" alt="Ilustrasi bagian tumbuhan dan kebutuhan cahaya serta air"><figcaption class="text-xs text-muted-foreground mt-2">Bagian tumbuhan dan kebutuhan cahaya serta air. Ilustrasi dari kerangka asesmen IPAS.</figcaption></figure>`;
        html += `<figure class="mt-6"><img class="max-w-full rounded-xl border border-slate-200 bg-white" src="data/assets/ipas-keragaman-indonesia.jpeg" alt="Peta Indonesia, rumah adat, dan pakaian tradisional daerah"><figcaption class="text-xs text-muted-foreground mt-2">Peta Indonesia, rumah adat, dan pakaian tradisional daerah. Ilustrasi dari kerangka asesmen IPAS.</figcaption></figure>`;
    }
    container.innerHTML = html;
}

function setReferenceSubject(id) { activeReferenceSubject = id; renderReferences(); lucide.createIcons(); }
function setReferenceKind(kind) { activeReferenceKind = kind; renderReferences(); }

function startQuiz(packageId) {
    const selectedPackage = packages.find(item => item.id === packageId);
    if (!selectedPackage) return;
    currentQuiz = {
        categoryId: selectedPackage.subject, packageId, packageNumber: selectedPackage.package,
        questions: selectedPackage.questions, currentIndex: 0, points: 0, correctCount: 0,
        incorrectCount: 0, partialCount: 0, answeredCount: 0, answered: false,
        responses: Array(selectedPackage.questions.length).fill(null), skipped: Array(selectedPackage.questions.length).fill(false),
        selected: null, remainingSeconds: selectedPackage.durationMinutes * 60,
        timerInterval: null, finished: false
    };
    const subject = subjects.find(item => item.id === selectedPackage.subject);
    document.getElementById('quiz-category-badge').innerText = `${subject.name} · Paket ${selectedPackage.package}`;
    switchView('quiz');
    renderQuestion();
    startTimer();
}

function renderQuestion() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const savedResponse = currentQuiz.responses[currentQuiz.currentIndex];
    currentQuiz.answered = false;
    currentQuiz.selected = savedResponse === null
        ? question.type === 'multiple' ? new Set() : question.type === 'category' ? Array(question.options.length).fill(null) : null
        : question.type === 'multiple' ? new Set(savedResponse) : question.type === 'category' ? [...savedResponse] : savedResponse;
    const total = currentQuiz.questions.length;
    const savedCount = currentQuiz.responses.filter(response => response !== null).length;
    document.getElementById('quiz-progress-text').innerText = `Soal ${currentQuiz.currentIndex + 1} dari ${total} · Terjawab ${savedCount}`;
    document.getElementById('quiz-score-live').innerText = `Ragu: ${currentQuiz.skipped.filter(Boolean).length}`;
    document.getElementById('quiz-progress-bar').style.width = `${(savedCount / total) * 100}%`;
    document.getElementById('quiz-question-title').innerText = question.prompt;
    const stimulus = document.getElementById('quiz-stimulus');
    stimulus.classList.toggle('hidden', !question.stimulus);
    stimulus.innerHTML = question.stimulus ? `<div class="font-semibold text-indigo-800 mb-2">Bacaan / stimulus</div>${richText(question.stimulus)}` : '';
    document.getElementById('quiz-explanation-box').classList.add('hidden');
    document.getElementById('quiz-skip').classList.toggle('hidden', savedResponse !== null);
    document.getElementById('quiz-finish').classList.toggle('hidden', savedCount !== total);
    renderAnswerControls();
    renderQuestionNavigator();
    lucide.createIcons();
}

function renderQuestionNavigator() {
    document.getElementById('quiz-question-map').innerHTML = currentQuiz.questions.map((_, index) => {
        const answered = currentQuiz.responses[index] !== null;
        const skipped = currentQuiz.skipped[index] && !answered;
        const current = index === currentQuiz.currentIndex;
        const tone = current ? 'border-indigo-600 bg-indigo-600 text-white' : answered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : skipped ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600';
        const status = answered ? 'sudah dijawab' : skipped ? 'ditandai ragu' : 'belum dijawab';
        return `<button type="button" onclick="goToQuestion(${index})" aria-label="Soal ${index + 1}, ${status}" aria-current="${current ? 'step' : 'false'}" class="h-10 min-w-10 rounded-lg border text-sm font-semibold ${tone}">${index + 1}</button>`;
    }).join('');
    const unanswered = currentQuiz.responses.filter(response => response === null).length;
    const uncertain = currentQuiz.skipped.filter((skipped, index) => skipped && currentQuiz.responses[index] === null).length;
    document.getElementById('quiz-map-legend').innerText = `${currentQuiz.responses.length - unanswered} terjawab · ${uncertain} ragu · ${unanswered} belum dijawab`;
}

function goToQuestion(index) {
    if (index < 0 || index >= currentQuiz.questions.length) return;
    currentQuiz.currentIndex = index;
    renderQuestion();
}

function renderAnswerControls() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const container = document.getElementById('quiz-options');
    const submit = document.getElementById('quiz-submit');
    submit.classList.remove('hidden');
    submit.innerText = currentQuiz.responses[currentQuiz.currentIndex] === null ? 'Simpan jawaban & lanjut' : 'Perbarui jawaban';
    if (question.type === 'single') {
        container.innerHTML = question.options.map((option, index) => `<button onclick="selectSingleAnswer(${index})" id="opt-${index}" class="w-full text-left p-4 rounded-xl border ${currentQuiz.selected === index ? 'border-indigo-400 bg-indigo-50' : 'border-border bg-white'} hover:border-indigo-400 hover:bg-indigo-50/30 transition-all font-medium text-slate-700 flex items-center justify-between group"><span class="flex items-center space-x-3"><span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 font-display font-bold text-xs flex items-center justify-center">${String.fromCharCode(65 + index)}</span><span class="text-sm sm:text-base">${escapeHtml(option)}</span></span><i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i></button>`).join('');
        submit.disabled = currentQuiz.selected === null;
    } else if (question.type === 'multiple') {
        container.innerHTML = `<p class="text-xs text-indigo-700 font-semibold">Pilih semua jawaban yang benar.</p>` + question.options.map((option, index) => {
            const chosen = currentQuiz.selected.has(index);
            return `<button onclick="toggleMultipleChoice(${index})" id="opt-${index}" class="w-full text-left p-4 rounded-xl border ${chosen ? 'border-indigo-400 bg-indigo-50' : 'border-border bg-white'} transition-all font-medium text-slate-700 flex items-center gap-3"><span class="w-6 h-6 rounded-md border ${chosen ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'} flex items-center justify-center">${chosen ? '✓' : ''}</span><span class="text-sm sm:text-base">${escapeHtml(option)}</span></button>`;
        }).join('');
        submit.disabled = currentQuiz.selected.size === 0;
    } else {
        const labels = question.categoryLabels || ['Benar', 'Salah'];
        container.innerHTML = question.options.map((statement, row) => `<div class="rounded-xl border border-slate-200 bg-white p-4 space-y-3"><p class="font-medium text-sm text-slate-800">${row + 1}. ${escapeHtml(statement)}</p><div class="flex gap-2">${labels.map((label, value) => {
            const chosen = currentQuiz.selected[row] === value;
            return `<button onclick="selectCategoryAnswer(${row},${value})" id="cat-${row}-${value}" class="flex-1 px-3 py-2 rounded-lg border ${chosen ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-50 text-slate-700'} text-sm font-semibold">${escapeHtml(label)}</button>`;
        }).join('')}</div></div>`).join('');
        submit.disabled = currentQuiz.selected.some(value => value === null);
    }
    if (question.type !== 'single') submit.classList.toggle('opacity-50', submit.disabled);
    lucide.createIcons();
}

function selectSingleAnswer(index) { currentQuiz.selected = index; renderAnswerControls(); }
function toggleMultipleChoice(index) {
    currentQuiz.selected.has(index) ? currentQuiz.selected.delete(index) : currentQuiz.selected.add(index);
    renderAnswerControls();
}
function selectCategoryAnswer(row, value) {
    currentQuiz.selected[row] = value;
    renderAnswerControls();
}
function submitAnswer() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    if (question.type === 'single' && currentQuiz.selected === null) return;
    if (question.type === 'multiple' && currentQuiz.selected.size === 0) return;
    if (question.type === 'category' && currentQuiz.selected.some(value => value === null)) return;
    submitResponse(currentQuiz.selected);
}

function gradeAnswer(question, selected) {
    if (selected === null || selected === undefined) return 0;
    if (question.type === 'single') return selected === question.answer ? 1 : 0;
    if (question.type === 'multiple') {
        const expected = new Set(question.answer || []);
        const actual = selected;
        if (expected.size === actual.size && [...expected].every(value => actual.has(value))) return 1;
        const hasWrong = [...actual].some(value => !expected.has(value));
        const missing = [...expected].filter(value => !actual.has(value)).length;
        return !hasWrong && missing === 1 ? 0.5 : 0;
    }
    const correct = selected.filter((value, index) => value === question.answer[index]).length;
    return correct === question.options.length ? 1 : correct === question.options.length - 1 ? 0.5 : 0;
}

function answerDescription(question) {
    if (question.type === 'single') return `Jawaban: ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`;
    if (question.type === 'multiple') return `Jawaban benar: ${(question.answer || []).map(i => `${String.fromCharCode(65 + i)}. ${question.options[i]}`).join('; ')}`;
    const labels = question.categoryLabels || ['Benar', 'Salah'];
    return `Kunci: ${question.answer.map((value, i) => `${i + 1}. ${labels[value]}`).join('; ')}`;
}

function submitResponse(selected) {
    const index = currentQuiz.currentIndex;
    currentQuiz.responses[index] = selected instanceof Set ? [...selected] : Array.isArray(selected) ? [...selected] : selected;
    currentQuiz.skipped[index] = false;
    const next = findNextUnanswered(index);
    if (next === -1) renderQuestion();
    else goToQuestion(next);
}

function findNextUnanswered(fromIndex) {
    const total = currentQuiz.questions.length;
    for (let step = 1; step <= total; step++) {
        const index = (fromIndex + step) % total;
        if (currentQuiz.responses[index] === null) return index;
    }
    return -1;
}

function skipCurrentQuestion() {
    const index = currentQuiz.currentIndex;
    if (currentQuiz.responses[index] !== null) return;
    currentQuiz.skipped[index] = true;
    const next = findNextUnanswered(index);
    if (next !== -1 && next !== index) goToQuestion(next);
    else {
        renderQuestionNavigator();
        document.getElementById('quiz-skip').classList.add('hidden');
    }
}

function markAnswerStyles(question, selected) {
    if (question.type === 'single') {
        question.options.forEach((_, index) => {
            const button = document.getElementById(`opt-${index}`);
            if (!button) return;
            button.disabled = true;
            if (index === question.answer) button.className += ' border-emerald-300 bg-emerald-50 text-emerald-900';
            else if (index === selected) button.className += ' border-rose-300 bg-rose-50 text-rose-900';
        });
    } else if (question.type === 'multiple') {
        question.options.forEach((_, index) => {
            const button = document.getElementById(`opt-${index}`);
            if (!button) return;
            button.disabled = true;
            if (question.answer.includes(index)) button.className = 'w-full text-left p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 font-medium flex items-center gap-3';
            else if (selected.has(index)) button.className = 'w-full text-left p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 font-medium flex items-center gap-3';
        });
    } else {
        question.options.forEach((_, row) => {
            question.categoryLabels.forEach((_, value) => {
                const button = document.getElementById(`cat-${row}-${value}`);
                if (!button) return;
                button.disabled = true;
                if (value === question.answer[row]) button.className = 'flex-1 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold';
                else if (selected[row] === value) button.className = 'flex-1 px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm font-semibold';
            });
        });
    }
}

function showExplanation(isCorrect, text) {
    const box = document.getElementById('quiz-explanation-box');
    const icon = document.getElementById('explanation-icon');
    const title = document.getElementById('explanation-title');
    box.classList.remove('hidden');
    box.className = isCorrect ? 'p-4 rounded-xl border border-emerald-200 bg-emerald-50/60' : 'p-4 rounded-xl border border-rose-200 bg-rose-50/60';
    icon.className = isCorrect ? 'w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5' : 'w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5';
    icon.innerHTML = `<i data-lucide="${isCorrect ? 'check' : 'x'}" class="w-5 h-5"></i>`;
    title.className = isCorrect ? 'font-display font-bold text-sm mb-1 text-emerald-800' : 'font-display font-bold text-sm mb-1 text-rose-800';
    title.innerText = isCorrect ? 'Bagus, jawabanmu tepat!' : 'Mari pahami pembahasannya';
    document.getElementById('explanation-text').innerText = text;
    lucide.createIcons();
}

function startTimer() {
    clearInterval(currentQuiz.timerInterval);
    updateTimerDisplay();
    currentQuiz.timerInterval = setInterval(() => {
        currentQuiz.remainingSeconds--;
        updateTimerDisplay();
        if (currentQuiz.remainingSeconds <= 0) finishOnTimeout();
    }, 1000);
}
function updateTimerDisplay() {
    const mins = Math.floor(currentQuiz.remainingSeconds / 60).toString().padStart(2, '0');
    const secs = (currentQuiz.remainingSeconds % 60).toString().padStart(2, '0');
    document.getElementById('quiz-timer').innerText = `${mins}:${secs}`;
}
function finishOnTimeout() {
    if (currentQuiz.finished) return;
    calculateQuizResults();
}

function nextQuestion() {
    const next = findNextUnanswered(currentQuiz.currentIndex);
    if (next !== -1) goToQuestion(next);
    else finalizeQuiz();
}

function finalizeQuiz() {
    if (currentQuiz.responses.some(response => response === null)) return;
    calculateQuizResults();
}

function calculateQuizResults() {
    if (currentQuiz.finished) return;
    currentQuiz.points = 0;
    currentQuiz.correctCount = 0;
    currentQuiz.incorrectCount = 0;
    currentQuiz.partialCount = 0;
    currentQuiz.answeredCount = currentQuiz.responses.filter(response => response !== null).length;
    currentQuiz.questions.forEach((question, index) => {
        const saved = currentQuiz.responses[index];
        const response = question.type === 'multiple' && saved !== null ? new Set(saved) : saved;
        const points = gradeAnswer(question, response);
        currentQuiz.points += points;
        if (points === 1) currentQuiz.correctCount++;
        else if (points === 0.5) currentQuiz.partialCount++;
        else currentQuiz.incorrectCount++;
    });
    finishQuiz();
}

function unlockBadge(id) {
    const badge = userState.badgesUnlocked.find(item => item.id === id);
    if (badge) badge.unlocked = true;
}
function finishedSubjectsStorageKey() { return `kecil-pintar-finished-subjects:${currentUserId}`; }
function finishQuiz() {
    if (currentQuiz.finished) return;
    currentQuiz.finished = true;
    clearInterval(currentQuiz.timerInterval);
    userState.completedCount += currentQuiz.answeredCount;
    userState.coins += 50;
    userState.xp += 25;
    if (userState.xp >= 100) { userState.level += Math.floor(userState.xp / 100); userState.xp %= 100; }
    unlockBadge('b1');
    if (currentQuiz.categoryId === 'matematika' && currentQuiz.points === currentQuiz.questions.length) unlockBadge('b2');
    if (currentQuiz.categoryId === 'indonesia') unlockBadge('b3');
    if (currentQuiz.categoryId === 'ipas') unlockBadge('b4');
    if (userState.coins >= 500) unlockBadge('b5');
    if (subjects.every(subject => packages.some(pkg => pkg.subject === subject.id))) {
        if (new Set([...(JSON.parse(localStorage.getItem(finishedSubjectsStorageKey()) || '[]')), currentQuiz.categoryId]).size >= 3) unlockBadge('b6');
    }
    if (userState.completedCount >= 60) unlockBadge('b7');
    if (userState.level >= 5) unlockBadge('b8');
    const finishedSubjects = new Set(JSON.parse(localStorage.getItem(finishedSubjectsStorageKey()) || '[]'));
    finishedSubjects.add(currentQuiz.categoryId);
    localStorage.setItem(finishedSubjectsStorageKey(), JSON.stringify([...finishedSubjects]));
    const grade = Math.round((currentQuiz.points / currentQuiz.questions.length) * 10000) / 100;
    document.getElementById('result-score').innerText = grade.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('result-correct').innerText = `${currentQuiz.correctCount} Tepat`;
    document.getElementById('result-incorrect').innerText = `${currentQuiz.incorrectCount} Salah`;
    document.getElementById('result-partial').innerText = `${currentQuiz.partialCount} Parsial`;
    document.getElementById('result-coins').innerHTML = `<i data-lucide="coins" class="w-5 h-5 fill-amber-400"></i> +50`;
    void persistProgress();
    switchView('result');
}

function restartQuiz() { startQuiz(currentQuiz.packageId); }
function confirmExitQuiz() {
    document.getElementById('custom-modal').classList.remove('hidden');
    document.getElementById('modal-btn-confirm').onclick = function() {
        clearInterval(currentQuiz.timerInterval);
        closeModal();
        switchView('dashboard');
    };
}
function closeModal() { document.getElementById('custom-modal').classList.add('hidden'); }

async function bootstrapApp() {
    try {
        const response = await fetch('data/tka-data.json');
        if (response.ok) appData = await response.json();
    } catch (_) {
        // Directly opening index.html uses the embedded copy of the source data.
    }
    initializeApp();
}

bootstrapApp();

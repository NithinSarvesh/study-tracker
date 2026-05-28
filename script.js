// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCDxvSSla6IJ2gZD0V_UM4lH-1bJ20fg8",
  authDomain: "study-forge-becd3.firebaseapp.com",
  projectId: "study-forge-becd3",
  storageBucket: "study-forge-becd3.firebasestorage.app",
  messagingSenderId: "158113112486",
  appId: "1:158113112486:web:065cbfe28a0fb4dd31af67",
  measurementId: "G-X1MTMCX1B2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ===== DATABASE (LocalStorage - simple version) =====
const DB = {
    get(key) {
        try { return JSON.parse(localStorage.getItem(`studyforge_${key}`)); }
        catch { return null; }
    },
    set(key, value) {
        localStorage.setItem(`studyforge_${key}`, JSON.stringify(value));
    },
    remove(key) {
        localStorage.removeItem(`studyforge_${key}`);
    }
};

// ===== STATE =====
let currentUser = null;
let isSignUp = false;
let subjects = [];
let studyLogs = [];
let exams = [];
let streakDays = [];
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerSubject = null;

// ===== PARTICLES =====
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 15000);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.5 + 0.1
        });
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(108, 99, 255, ${p.opacity})`;
        ctx.fill();
    });

    particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < 100) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(108, 99, 255, ${0.05 * (1 - dist / 100)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        });
    });
    requestAnimationFrame(animateParticles);
}

resizeCanvas();
createParticles();
animateParticles();
window.addEventListener('resize', () => { resizeCanvas(); createParticles(); });

// ===== AUTH =====
function toggleAuthMode() {
    isSignUp = !isSignUp;
    const nameGroup = document.getElementById('nameGroup');
    const loginBtn = document.getElementById('loginBtn');
    const toggleText = document.getElementById('toggleText');
    const toggleLink = document.getElementById('toggleLink');

    if (isSignUp) {
        nameGroup.style.display = 'block';
        loginBtn.textContent = 'Create Account';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
    } else {
        nameGroup.style.display = 'none';
        loginBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const name = document.getElementById('regName').value;

    try {
        if (isSignUp) {
            if (!name) { showToast('Please enter your name', 'error'); return; }
            
            // Create Firebase user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Save user profile to Firestore
            await setDoc(doc(db, "users", user.uid), {
                name: name,
                email: email,
                createdAt: new Date().toISOString()
            });
            
            currentUser = { uid: user.uid, email, name };
            showToast('Account created! 🎉', 'success');
            enterApp();
        } else {
            // Sign in
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Get profile from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userData = userDoc.data();
            
            currentUser = { uid: user.uid, email, name: userData.name };
            showToast(`Welcome back, ${userData.name}! 🎉`, 'success');
            enterApp();
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
}

async function handleLogout() {
    if (timerRunning) stopTimer();
    await signOut(auth);
    currentUser = null;
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPage').classList.remove('hidden');
    showToast('Logged out', 'info');
}

// Auto-login check
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentUser = { uid: user.uid, email: user.email, name: userDoc.data().name };
            enterApp();
        }
    }
});

function enterApp() {
    document.getElementById('loginPage').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        initApp();
    }, 500);
}

function handleLogout() {
    if (timerRunning) stopTimer();
    DB.remove('currentUser');
    currentUser = null;
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPage').classList.remove('hidden');
    showToast('Logged out', 'info');
}

function checkSession() {
    const saved = DB.get('currentUser');
    if (saved) {
        currentUser = saved;
        enterApp();
    }
}

// ===== APP INIT =====
function initApp() {
    document.getElementById('navUserName').textContent = currentUser.name;
    document.getElementById('navAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('greetingName').textContent = currentUser.name.split(' ')[0];

    loadUserData();
    renderSubjects();
    renderExams();
    renderStats();
    renderCalendar();
    renderLog();
    renderWeeklyChart();
    setRandomQuote();
}

function loadUserData() {
    subjects = DB.get(`subjects_${currentUser.email}`) || [];
    studyLogs = DB.get(`logs_${currentUser.email}`) || [];
    exams = DB.get(`exams_${currentUser.email}`) || [];
    streakDays = DB.get(`streak_${currentUser.email}`) || [];
}
// ===== SUBJECTS =====
async function saveSubjects() {
    if (!currentUser) return;
    await setDoc(doc(db, `users/${currentUser.uid}/data/subjects`), { list: subjects });
}

async function loadUserData() {
    if (!currentUser) return;
    const subjectsDoc = await getDoc(doc(db, `users/${currentUser.uid}/data/subjects`));
    const logsDoc = await getDoc(doc(db, `users/${currentUser.uid}/data/logs`));
    const examsDoc = await getDoc(doc(db, `users/${currentUser.uid}/data/exams`));
    const streakDoc = await getDoc(doc(db, `users/${currentUser.uid}/data/streak`));
    
    subjects = subjectsDoc.exists() ? subjectsDoc.data().list : [];
    studyLogs = logsDoc.exists() ? logsDoc.data().list : [];
    exams = examsDoc.exists() ? examsDoc.data().list : [];
    streakDays = streakDoc.exists() ? streakDoc.data().list : [];
}
// Apply similar pattern to saveLogs, saveExams, saveStreak
function addSubject() {
    const nameInput = document.getElementById('newSubjectName');
    const colorSelect = document.getElementById('newSubjectColor');
    const name = nameInput.value.trim();
    const color = colorSelect.value;

    if (!name) { showToast('Please enter a subject name', 'error'); return; }
    if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
        showToast('Subject already exists!', 'error'); return;
    }

    subjects.push({ id: Date.now(), name, color, totalMinutes: 0 });
    saveSubjects();
    nameInput.value = '';
    renderSubjects();
    renderStats();
    showToast(`Added "${name}"! 📖`, 'success');
}

function deleteSubject(id) {
    subjects = subjects.filter(s => s.id !== id);
    saveSubjects();
    renderSubjects();
    renderStats();
    showToast('Subject removed', 'info');
}

function renderSubjects() {
    const list = document.getElementById('subjectsList');
    const timerSelect = document.getElementById('timerSubjectSelect');

    if (subjects.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px;">No subjects yet. Add one below! 👇</p>';
    } else {
        list.innerHTML = subjects.map(s => `
            <div class="subject-item">
                <div class="subject-info">
                    <div class="subject-color" style="background: ${s.color}; box-shadow: 0 0 8px ${s.color}50;"></div>
                    <div>
                        <div class="subject-name">${s.name}</div>
                        <div class="subject-hours">${formatMinutes(s.totalMinutes)} total</div>
                    </div>
                </div>
                <div class="subject-actions">
                    <button class="btn-study" onclick="quickStudy(${s.id})" title="Quick log">✏️</button>
                    <button class="btn-delete" onclick="deleteSubject(${s.id})" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    timerSelect.innerHTML = '<option value="">Select a subject...</option>' +
        subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function quickStudy(subjectId) {
    const minutes = prompt('How many minutes did you study?');
    if (!minutes || isNaN(minutes) || parseInt(minutes) <= 0) return;

    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const mins = parseInt(minutes);
    subject.totalMinutes += mins;
    saveSubjects();

    const today = getTodayString();
    studyLogs.push({
        subject: subject.name,
        color: subject.color,
        minutes: mins,
        date: today,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveLogs();

    if (!streakDays.includes(today)) {
        streakDays.push(today);
        saveStreak();
    }

    renderSubjects();
    renderStats();
    renderCalendar();
    renderLog();
    renderWeeklyChart();
    showToast(`Logged ${mins} minutes! 💪`, 'success');
}

// ===== TIMER =====
function startTimer() {
    const select = document.getElementById('timerSubjectSelect');
    if (!select.value) { showToast('Please select a subject first!', 'error'); return; }

    timerSubject = subjects.find(s => s.id === parseInt(select.value));
    timerRunning = true;

    document.getElementById('timerCircle').classList.add('active');
    document.getElementById('btnStart').style.display = 'none';
    document.getElementById('btnPause').style.display = 'inline-block';
    document.getElementById('btnStop').style.display = 'inline-block';

    timerInterval = setInterval(() => {
        timerSeconds++;
        updateTimerDisplay();
        updateTimerProgress();
    }, 1000);

    showToast(`Timer started for ${timerSubject.name}! 🚀`, 'success');
}

function pauseTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById('timerCircle').classList.remove('active');
        document.getElementById('btnPause').textContent = '▶ Resume';
    } else {
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
            updateTimerProgress();
        }, 1000);
        timerRunning = true;
        document.getElementById('timerCircle').classList.add('active');
        document.getElementById('btnPause').textContent = '⏸ Pause';
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerCircle').classList.remove('active');

    if (timerSeconds >= 60 && timerSubject) {
        const mins = Math.floor(timerSeconds / 60);
        timerSubject.totalMinutes += mins;
        saveSubjects();

        const today = getTodayString();
        studyLogs.push({
            subject: timerSubject.name,
            color: timerSubject.color,
            minutes: mins,
            date: today,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        saveLogs();

        if (!streakDays.includes(today)) {
            streakDays.push(today);
            saveStreak();
        }

        showToast(`Logged ${mins} minutes! 🎉`, 'success');
    }

    timerSeconds = 0;
    timerSubject = null;
    updateTimerDisplay();
    updateTimerProgress();

    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnPause').style.display = 'none';
    document.getElementById('btnStop').style.display = 'none';
    document.getElementById('btnPause').textContent = '⏸ Pause';

    renderSubjects();
    renderStats();
    renderCalendar();
    renderLog();
    renderWeeklyChart();
}

function updateTimerDisplay() {
    const h = Math.floor(timerSeconds / 3600);
    const m = Math.floor((timerSeconds % 3600) / 60);
    const s = timerSeconds % 60;
    document.getElementById('timerDisplay').textContent =
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerProgress() {
    const circle = document.getElementById('timerProgress');
    const circumference = 2 * Math.PI * 100;
    const progress = (timerSeconds % 3600) / 3600;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference * (1 - progress);
}

// ===== EXAMS =====
function addExam() {
    const name = document.getElementById('examName').value.trim();
    const date = document.getElementById('examDate').value;

    if (!name) { showToast('Please enter exam name', 'error'); return; }
    if (!date) { showToast('Please select a date', 'error'); return; }

    exams.push({ id: Date.now(), name, date });
    saveExams();
    document.getElementById('examName').value = '';
    document.getElementById('examDate').value = '';
    renderExams();
    showToast(`Exam "${name}" added! 📅`, 'success');
}

function deleteExam(id) {
    exams = exams.filter(e => e.id !== id);
    saveExams();
    renderExams();
    showToast('Exam removed', 'info');
}

function renderExams() {
    const list = document.getElementById('examsList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...exams].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px;">No exams scheduled. 👇</p>';
    } else {
        list.innerHTML = sorted.map(exam => {
            const examDate = new Date(exam.date);
            examDate.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft <= 7 && daysLeft >= 0;
            const isPast = daysLeft < 0;

            return `
                <div class="exam-item ${isUrgent ? 'urgent' : ''}">
                    <div class="exam-info">
                        <h4>${exam.name}</h4>
                        <p>${examDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div class="exam-countdown ${isUrgent ? 'urgent' : ''}">
                        <div class="days">${isPast ? '✓' : daysLeft}</div>
                        <div class="label">${isPast ? 'Done' : daysLeft === 1 ? 'day left' : 'days left'}</div>
                    </div>
                    <button class="exam-delete" onclick="deleteExam(${exam.id})">✕</button>
                </div>
            `;
        }).join('');
    }
}

// ===== STATS =====
function renderStats() {
    const today = getTodayString();
    const todayLogs = studyLogs.filter(l => l.date === today);
    const todayMinutes = todayLogs.reduce((sum, l) => sum + l.minutes, 0);
    const totalMinutes = subjects.reduce((sum, s) => sum + s.totalMinutes, 0);
    const streak = calculateStreak();

    document.getElementById('statTodayHours').textContent = formatMinutes(todayMinutes);
    document.getElementById('statTotalHours').textContent = formatMinutes(totalMinutes);
    document.getElementById('statStreak').textContent = streak;
    document.getElementById('statSubjects').textContent = subjects.length;
    document.getElementById('streakCount').textContent = streak;
}

function calculateStreak() {
    if (streakDays.length === 0) return 0;
    const sorted = [...streakDays].sort().reverse();
    const today = getTodayString();
    const yesterday = getDateOffset(-1);

    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = new Date(sorted[i]);
        const prev = new Date(sorted[i + 1]);
        const diff = (current - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
    }
    return streak;
}

// ===== CALENDAR =====
function renderCalendar() {
    const cal = document.getElementById('streakCalendar');
    const today = new Date();
    const todayStr = getTodayString();

    let html = '';
    for (let i = 27; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const isActive = streakDays.includes(dateStr);
        const isToday = dateStr === todayStr;
        html += `<div class="streak-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}">${date.getDate()}</div>`;
    }
    cal.innerHTML = html;
}

// ===== ACTIVITY LOG =====
function renderLog() {
    const list = document.getElementById('logList');
    const today = getTodayString();
    const todayLogs = studyLogs.filter(l => l.date === today).reverse();

    if (todayLogs.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No activity yet today. 🚀</p>';
    } else {
        list.innerHTML = todayLogs.map(log => `
            <div class="log-item" style="border-left-color: ${log.color};">
                <span><strong>${log.subject}</strong> — ${log.minutes} min</span>
                <span class="log-time">${log.time}</span>
            </div>
        `).join('');
    }
}

// ===== WEEKLY CHART =====
function renderWeeklyChart() {
    const chartCanvas = document.getElementById('weeklyChart');
    const chartCtx = chartCanvas.getContext('2d');
    const rect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = rect.width * 2;
    chartCanvas.height = rect.height * 2;
    chartCtx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayLogs = studyLogs.filter(l => l.date === dateStr);
        const totalMin = dayLogs.reduce((sum, l) => sum + l.minutes, 0);
        days.push({ label: dayNames[date.getDay()], value: totalMin / 60, date: dateStr });
    }

    const maxVal = Math.max(...days.map(d => d.value), 1);
    const barWidth = chartWidth / days.length * 0.6;
    const gap = chartWidth / days.length;

    chartCtx.clearRect(0, 0, width, height);

    chartCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    chartCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        chartCtx.beginPath();
        chartCtx.moveTo(padding.left, y);
        chartCtx.lineTo(width - padding.right, y);
        chartCtx.stroke();

        chartCtx.fillStyle = 'rgba(255,255,255,0.4)';
        chartCtx.font = '11px system-ui';
        chartCtx.textAlign = 'right';
        chartCtx.fillText(`${((maxVal / 4) * (4 - i)).toFixed(1)}h`, padding.left - 8, y + 4);
    }

    days.forEach((day, i) => {
        const x = padding.left + gap * i + (gap - barWidth) / 2;
        const barHeight = (day.value / maxVal) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        const gradient = chartCtx.createLinearGradient(x, y, x, padding.top + chartHeight);
        gradient.addColorStop(0, '#6c63ff');
        gradient.addColorStop(1, 'rgba(108, 99, 255, 0.2)');

        const radius = 6;
        chartCtx.beginPath();
        chartCtx.moveTo(x + radius, y);
        chartCtx.lineTo(x + barWidth - radius, y);
        chartCtx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        chartCtx.lineTo(x + barWidth, padding.top + chartHeight);
        chartCtx.lineTo(x, padding.top + chartHeight);
        chartCtx.lineTo(x, y + radius);
        chartCtx.quadraticCurveTo(x, y, x + radius, y);
        chartCtx.fillStyle = gradient;
        chartCtx.shadowColor = 'rgba(108, 99, 255, 0.3)';
        chartCtx.shadowBlur = 10;
        chartCtx.fill();
        chartCtx.shadowBlur = 0;

        chartCtx.fillStyle = day.date === getTodayString() ? '#6c63ff' : 'rgba(255,255,255,0.4)';
        chartCtx.font = day.date === getTodayString() ? 'bold 12px system-ui' : '11px system-ui';
        chartCtx.textAlign = 'center';
        chartCtx.fillText(day.label, x + barWidth / 2, height - padding.bottom + 20);
    });
}

// ===== QUOTES =====
const quotes = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" }
];

function setRandomQuote() {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quoteText').textContent = `"${q.text}"`;
    document.getElementById('quoteAuthor').textContent = `— ${q.author}`;
}

// ===== UTILITIES =====
function getTodayString() { return new Date().toISOString().split('T')[0]; }

function getDateOffset(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
}

function formatMinutes(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type]} ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

window.addEventListener('resize', () => {
    if (document.getElementById('appContainer').classList.contains('active')) {
        renderWeeklyChart();
    }
});

// ===== START =====
checkSession();
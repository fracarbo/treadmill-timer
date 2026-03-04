let timer = null;
let changeTimer = 0;
let elapsed = 0;
let totalSec = 0;
let changeFreqSec = 0;
let isPaused = false;
let workoutData = [];
let currentSpeed = 0;
let lastSpeed = 0;
let workoutActive = false;
let wakeLockSentinel = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function step(id, amount) {
    const input = document.getElementById(id);
    if (!input) return;
    let val = parseFloat(input.value) || 0;
    val = +(val + amount).toFixed(2);
    if (val < 0) val = 0;
    input.value = val;
    input.dispatchEvent(new Event('change'));
}

function stepSpeed(id, direction) {
    const amount = parseFloat(document.getElementById('speed-step').value) || 0.5;
    step(id, direction * amount);
}

function playBeep() {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) { console.error("Audio error", e); }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateNewSpeed() {
    const min = parseFloat(document.getElementById('min-speed').value);
    const max = parseFloat(document.getElementById('max-speed').value);
    const stepVal = parseFloat(document.getElementById('speed-step').value);

    const options = [];
    for (let s = min; s <= max; s = +(s + stepVal).toFixed(2)) {
        options.push(s);
    }

    let nextSpeed;
    if (options.length === 0) return min;

    do {
        nextSpeed = options[Math.floor(Math.random() * options.length)];
    } while (options.length > 1 && nextSpeed === lastSpeed);

    lastSpeed = nextSpeed;
    return nextSpeed;
}

function triggerFlash() {
    const container = document.getElementById('speed-container');
    if (container) container.classList.add('flash-active');
    setTimeout(() => container && container.classList.remove('flash-active'), 500);

    if ('vibrate' in navigator) navigator.vibrate(200);

    const soundEl = document.getElementById('option-sound');
    if (soundEl && soundEl.checked) playBeep();
}

function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (sentinel) {
        wakeLockSentinel = sentinel;
    }).catch(function () {});
}

function releaseWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release();
        wakeLockSentinel = null;
    }
}

function startWorkout() {
    const minSpeed = document.getElementById('min-speed').value;
    const maxSpeed = document.getElementById('max-speed').value;
    const speedStep = document.getElementById('speed-step').value;
    const changeMin = document.getElementById('change-min').value;
    const changeSec = document.getElementById('change-sec').value;
    const totalDuration = document.getElementById('total-duration').value;
    const optionSound = document.getElementById('option-sound').checked;
    const optionWakeLock = document.getElementById('option-wake-lock').checked;

    const settings = {
        minSpeed,
        maxSpeed,
        speedStep,
        changeMin,
        changeSec,
        totalDuration,
        optionSound,
        optionWakeLock
    };
    localStorage.setItem('treadmillSettings', JSON.stringify(settings));

    const durationMin = parseFloat(totalDuration);
    const freqMin = parseInt(changeMin) || 0;
    const freqSec = parseInt(changeSec) || 0;

    totalSec = Math.floor(durationMin * 60);
    changeFreqSec = (freqMin * 60) + freqSec;

    if (totalSec <= 0 || changeFreqSec <= 0) {
        alert("Inserisci valori validi.");
        return;
    }

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('workout-screen').classList.remove('hidden');

    elapsed = 0;
    changeTimer = 0;
    workoutData = [];
    isPaused = false;
    workoutActive = true;

    var wakeLockEl = document.getElementById('option-wake-lock');
    if (wakeLockEl && wakeLockEl.checked) requestWakeLock();

    updateSpeed();

    if (timer) clearInterval(timer);
    timer = setInterval(function () {
        if (isPaused) return;

        elapsed++;
        changeTimer++;

        document.getElementById('time-elapsed').textContent = formatTime(elapsed);
        document.getElementById('time-remaining').textContent = formatTime(Math.max(0, totalSec - elapsed));

        if (changeTimer >= changeFreqSec) {
            updateSpeed();
            changeTimer = 0;
        }

        if (elapsed >= totalSec) {
            executeStop();
        }
    }, 1000);
}

function updateSpeed() {
    currentSpeed = generateNewSpeed();
    document.getElementById('current-speed').textContent = currentSpeed.toFixed(1);
    workoutData.push({ time: elapsed, speed: currentSpeed });
    triggerFlash();
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    btn.textContent = isPaused ? 'Riprendi' : 'Pausa';
    btn.classList.toggle('bg-blue-600', isPaused);
    btn.classList.toggle('bg-slate-700', !isPaused);
}

function openStopModal() {
    isPaused = true;
    document.getElementById('confirm-modal').style.display = 'flex';
}

function closeStopModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn && pauseBtn.textContent === 'Pausa') {
        isPaused = false;
    }
}

function executeStop() {
    workoutActive = false;
    releaseWakeLock();
    if (timer) clearInterval(timer);
    document.getElementById('confirm-modal').style.display = 'none';
    document.getElementById('workout-screen').classList.add('hidden');
    document.getElementById('summary-screen').classList.remove('hidden');
    showSummary();
}

function showSummary() {
    if (workoutData.length === 0) return;

    const speeds = workoutData.map(function (d) { return d.speed; });
    const avg = speeds.reduce(function (a, b) { return a + b; }, 0) / speeds.length;
    const maxSpeed = Math.max.apply(null, speeds);
    const minSpeed = Math.min.apply(null, speeds);

    document.getElementById('sum-duration').textContent = formatTime(elapsed);
    document.getElementById('sum-changes').textContent = workoutData.length;
    document.getElementById('sum-avg').textContent = avg.toFixed(1) + ' km/h';
    document.getElementById('sum-range').textContent = minSpeed + ' / ' + maxSpeed;

    const ctx = document.getElementById('workoutChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: workoutData.map(function (d) { return formatTime(d.time); }),
            datasets: [{
                label: 'Velocità (km/h)',
                data: workoutData.map(function (d) { return d.speed; }),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                stepped: true,
                tension: 0,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', maxRotation: 0 }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Carica impostazioni salvate
    const savedSettings = localStorage.getItem('treadmillSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (settings.minSpeed) document.getElementById('min-speed').value = settings.minSpeed;
            if (settings.maxSpeed) document.getElementById('max-speed').value = settings.maxSpeed;
            if (settings.speedStep) document.getElementById('speed-step').value = settings.speedStep;
            if (settings.changeMin) document.getElementById('change-min').value = settings.changeMin;
            if (settings.changeSec) document.getElementById('change-sec').value = settings.changeSec;
            if (settings.totalDuration) document.getElementById('total-duration').value = settings.totalDuration;
            if (settings.hasOwnProperty('optionSound')) document.getElementById('option-sound').checked = settings.optionSound;
            if (settings.hasOwnProperty('optionWakeLock')) document.getElementById('option-wake-lock').checked = settings.optionWakeLock;
        } catch (e) {
            console.error("Errore nel caricamento delle impostazioni", e);
        }
    }

    var toggle = document.getElementById('accordion-toggle');
    var content = document.getElementById('accordion-content');
    var icon = document.getElementById('accordion-icon');
    if (toggle && content && icon) {
        toggle.addEventListener('click', function () {
            content.classList.toggle('hidden');
            icon.classList.toggle('is-open');
        });
    }
});

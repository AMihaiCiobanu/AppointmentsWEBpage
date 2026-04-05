import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDVcYMPg0lWd4tMxlfm5MLS8T6jtEXcoi8',
  authDomain: 'appointmentssync-c680f.firebaseapp.com',
  projectId: 'appointmentssync-c680f',
  storageBucket: 'appointmentssync-c680f.firebasestorage.app',
  messagingSenderId: '600609525849',
  appId: '1:600609525849:web:6d37c54629691bf6752148'
};

const app = initializeApp(firebaseConfig);

// App Check — blocks non-browser clients (curl, scripts, bots) from accessing Firestore.
// Replace RECAPTCHA_V3_SITE_KEY with the key from:
// Firebase Console → App Check → Web apps → Add provider → reCAPTCHA v3
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LcieqUsAAAAAJi2J0k-aawVuqpArTNRx1iccCRr'),
  isTokenAutoRefreshEnabled: true
});

const db = getFirestore(app);

const state = {
  linkId: null,
  linkDoc: null,
  uid: null,
  currency: 'EUR',
  services: [],
  selectedService: null,
  selectedDate: null,
  selectedSlotStart: null,
  selectedSlotEnd: null,
  workingRange: null,
  slots: [],
  currentStep: 1,
  get lang() { return localStorage.getItem('lang') || 'en'; }
};

// Translation helper
function t(key) {
  const lang = state.lang;
  return (window.TRANSLATIONS && window.TRANSLATIONS[lang] && window.TRANSLATIONS[lang][key]) || key;
}

const el = {
  loading: document.getElementById('state-loading'),
  error: document.getElementById('state-error'),
  success: document.getElementById('state-success'),
  flow: document.getElementById('booking-flow'),
  stepsContainer: document.getElementById('booking-steps'),
  step1: document.getElementById('step-1-content'),
  step2: document.getElementById('step-2-content'),
  step3: document.getElementById('step-3-content'),
  services: document.getElementById('services'),
  dateInput: document.getElementById('booking-date'),
  workingHours: document.getElementById('working-hours'),
  slots: document.getElementById('slots'),
  slotsLoader: document.getElementById('slots-loader'),
  slotsEmptyState: document.getElementById('slots-empty-state'),
  form: document.getElementById('booking-form'),
  name: document.getElementById('client-name'),
  phone: document.getElementById('client-phone'),
  note: document.getElementById('client-note'),
  submit: document.getElementById('submit-btn'),
  toStep3: document.getElementById('to-step-3'),
  backTo1: document.getElementById('back-to-1'),
  backTo2: document.getElementById('back-to-2')
};

function showError(message) {
  el.loading.classList.add('hidden');
  el.flow.classList.add('hidden');
  el.stepsContainer.classList.add('hidden');
  el.error.innerHTML = `<p>${message}</p><p class="booking-error-contact">${t('booking_error_contact')}</p>`;
  el.error.classList.remove('hidden');
}

function showFlow() {
  el.loading.classList.add('hidden');
  el.error.classList.add('hidden');
  el.flow.classList.remove('hidden');
  el.stepsContainer.classList.remove('hidden');
  goToStep(1);
}

function goToStep(step) {
  state.currentStep = step;
  
  // Update UI sections
  el.step1.classList.toggle('hidden', step !== 1);
  el.step2.classList.toggle('hidden', step !== 2);
  el.step3.classList.toggle('hidden', step !== 3);
  
  // Update step indicators
  document.querySelectorAll('.step').forEach(s => {
    const sNum = parseInt(s.dataset.step);
    s.classList.toggle('active', sNum === step);
    s.classList.toggle('completed', sNum < step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function fmtHHmmFromMinutes(minutes) {
  const m = Math.max(0, Math.min(1439, minutes));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function localDateToWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  return dow === 0 ? 7 : dow;
}

function daySettingsKey(dow) {
  switch (dow) {
    case 1:
      return ['programStartLuni', 'programEndLuni'];
    case 2:
      return ['programStartMarti', 'programEndMarti'];
    case 3:
      return ['programStartMiercuri', 'programEndMiercuri'];
    case 4:
      return ['programStartJoi', 'programEndJoi'];
    case 5:
      return ['programStartVineri', 'programEndVineri'];
    case 6:
      return ['programStartSambata', 'programEndSambata'];
    case 7:
      return ['programStartDuminica', 'programEndDuminica'];
    default:
      return ['programStartLuni', 'programEndLuni'];
  }
}

function parseLinkId() {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('id');
  if (fromQuery) return fromQuery.trim();
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'booking') {
    return parts[1].trim();
  }
  return null;
}

const phoneRegex = /^[\+]?[0-9\s\-]{7,20}$/;

function updateValidation() {
  // Step 2 validation
  el.toStep3.disabled = !state.selectedSlotStart;

  // Step 3 validation
  const phoneValue = el.phone.value.trim();
  const isPhoneValid = phoneRegex.test(phoneValue);
  
  // Show error only after some input length or if it was invalid before
  const phoneErrorEl = document.getElementById('phone-error');
  if (phoneValue.length > 5) {
    phoneErrorEl.classList.toggle('hidden', isPhoneValid);
  }

  const ok =
    !!state.selectedService &&
    !!state.selectedDate &&
    !!state.selectedSlotStart &&
    el.name.value.trim().length > 1 &&
    isPhoneValid;
  el.submit.disabled = !ok;
}

async function loadLink() {
  state.linkId = parseLinkId();
  if (!state.linkId) {
    showError(t('booking_error_link'));
    return false;
  }

  const linkRef = doc(db, 'bookingLinks', state.linkId);
  const linkSnap = await getDoc(linkRef);
  if (!linkSnap.exists()) {
    showError(t('booking_error_link_not_exist'));
    return false;
  }

  const data = linkSnap.data();
  const expiresAt = data.expiresAt?.toDate?.() || null;
  if (data.isDeleted || data.active === false) {
    showError(t('booking_error_link_disabled'));
    return false;
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    showError(t('booking_error_link_expired'));
    return false;
  }

  state.linkDoc = data;
  state.uid = data.uid;

  if (!state.uid) {
    showError(t('booking_error_link_owner'));
    return false;
  }
  return true;
}

async function loadServices() {
  const servicesRef = collection(db, `users/${state.uid}/servicii`);
  const snap = await getDocs(servicesRef);

  state.services = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.isDeleted !== true)
    .map(s => ({
      id: s.id,
      name: s.nume || '',
      durationMinutes: Number(s.durataMinute || 0),
      price: Number(s.pret || 0)
    }))
    .filter(s => s.name && s.durationMinutes > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (state.services.length === 0) {
    showError(t('booking_error_no_services'));
    return;
  }

  renderServices();
}

function renderServices() {
  el.services.innerHTML = '';
  for (const svc of state.services) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `service-btn ${state.selectedService?.id === svc.id ? 'active' : ''}`;
    const mainDiv = document.createElement('div');
    mainDiv.className = 'service-main';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = svc.name;
    const durSpan = document.createElement('span');
    durSpan.textContent = `${svc.durationMinutes} ${t('booking_minutes_suffix')}`;
    mainDiv.appendChild(nameSpan);
    mainDiv.appendChild(durSpan);
    const subDiv = document.createElement('div');
    subDiv.className = 'service-sub';
    subDiv.textContent = svc.price > 0 ? formatPrice(svc.price, state.currency) : t('booking_price_in_app');
    btn.appendChild(mainDiv);
    btn.appendChild(subDiv);
    btn.addEventListener('click', () => {
      state.selectedService = svc;
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      renderServices();
      renderSlots();
      void loadSlotsForSelectedDate();
      updateValidation();
      // Auto-advance to next step
      setTimeout(() => goToStep(2), 300);
    });
    el.services.appendChild(btn);
  }
}

function getMinDateISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function slotOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function loadWorkingRange(dateISO) {
  const setRef = doc(db, `users/${state.uid}/setari/bookingPublic`);
  const snap = await getDoc(setRef);
  if (!snap.exists()) return { start: 0, end: 0 };

  const set = snap.data();
  if (set.currency) state.currency = set.currency;
  const dow = localDateToWeekday(dateISO);
  const [startKey, endKey] = daySettingsKey(dow);
  const start = Number(set[startKey] || 0);
  const end = Number(set[endKey] || 0);
  if (!(start >= 0 && end > start && end <= 1439)) {
    return { start: 0, end: 0 };
  }
  return { start, end };
}

function toDayBoundary(dateISO, end = false) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

async function loadTimeOffsForDate(dateISO) {
  const dayStart = toDayBoundary(dateISO, false);
  const dayEnd = toDayBoundary(dateISO, true);
  const colRef = collection(db, `users/${state.uid}/perioadeConcediu`);
  const qy = query(colRef, where('dataEnd', '>=', Timestamp.fromDate(dayStart)));
  const snap = await getDocs(qy);
  return snap.docs
    .map(d => d.data())
    .filter(row => {
      if (row.isDeleted === true) return false;
      const start = row.dataStart?.toDate?.();
      return start && start <= dayEnd;
    });
}

function isFullDayTimeOff(rows) {
  return rows.some(row => row.isFullDay === true);
}

function partialTimeOffBusySlots(rows) {
  return rows
    .filter(row => row.isFullDay !== true)
    .map(row => {
      const start = row.dataStart?.toDate?.();
      const end = row.dataEnd?.toDate?.();
      if (!start || !end) return null;
      return { start, end };
    })
    .filter(Boolean);
}

async function loadBusySlots(dateISO) {
  const startBoundary = toDayBoundary(dateISO, false);
  const endBoundary = toDayBoundary(dateISO, true);
  const colRef = collection(db, `users/${state.uid}/sloturiOcupate`);
  const qy = query(
    colRef,
    where('oraStart', '>=', Timestamp.fromDate(startBoundary)),
    where('oraStart', '<=', Timestamp.fromDate(endBoundary))
  );

  const snap = await getDocs(qy);
  return snap.docs
    .map(d => d.data())
    .filter(row => row.isDeleted !== true)
    .map(row => {
      const startDate = row.oraStart?.toDate?.();
      if (!startDate) return null;
      const duration = Number(row.durataMinute || 0);
      if (duration <= 0) return null;
      const endDate = new Date(startDate.getTime() + duration * 60000);
      return { start: startDate, end: endDate };
    })
    .filter(Boolean);
}

async function loadSlotsForSelectedDate() {
  if (!state.selectedDate || !state.selectedService) {
    state.slots = [];
    renderSlots();
    return;
  }

  // Show loader and hide old content
  el.slotsLoader.classList.remove('hidden');
  el.slots.classList.add('hidden');
  el.slotsEmptyState.classList.add('hidden');

  try {
    const { start, end } = await loadWorkingRange(state.selectedDate);
    state.workingRange = { start, end };
    if (end <= start) {
      state.slots = [];
      renderSlots();
      return;
    }

    const timeOffRows = await loadTimeOffsForDate(state.selectedDate);
    if (isFullDayTimeOff(timeOffRows)) {
      state.workingRange = { start: 0, end: 0 };
      state.slots = [];
      renderSlots();
      return;
    }

    const busy = [
      ...await loadBusySlots(state.selectedDate),
      ...partialTimeOffBusySlots(timeOffRows)
    ];
    const duration = state.selectedService.durationMinutes;
    const interval = 30;

    const [y, m, d] = state.selectedDate.split('-').map(Number);
    const dayBase = new Date(y, m - 1, d, 0, 0, 0, 0);
    const now = new Date();

    const slots = [];
    for (let startMin = start; startMin + duration <= end; startMin += interval) {
      const slotStart = new Date(dayBase.getTime() + startMin * 60000);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      if (slotStart <= now) continue;

      const blocked = busy.some(b => slotOverlaps(slotStart, slotEnd, b.start, b.end));
      if (!blocked) {
        slots.push({
          startDate: slotStart,
          endDate: slotEnd,
          label: `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
        });
      }
    }

    state.slots = slots;
    renderSlots();
  } finally {
    // Hide loader and show slots (renderSlots handles empty state)
    el.slotsLoader.classList.add('hidden');
    el.slots.classList.remove('hidden');
  }
}

function renderSlots() {
  el.slots.innerHTML = '';
  el.slotsEmptyState.classList.add('hidden');
  el.workingHours.classList.add('hidden');

  if (!state.selectedService) {
    el.slots.innerHTML = `<p class="muted">${t('booking_select_service_first')}</p>`;
    el.workingHours.textContent = '';
    return;
  }

  if (!state.selectedDate) {
    el.slots.innerHTML = `<p class="muted">${t('booking_select_date_first')}</p>`;
    el.workingHours.textContent = '';
    return;
  }

  if (state.workingRange && state.workingRange.end > state.workingRange.start) {
    el.workingHours.textContent = `🕒 ${t('booking_working_hours')}: ${fmtHHmmFromMinutes(state.workingRange.start)} - ${fmtHHmmFromMinutes(state.workingRange.end)}`;
    el.workingHours.classList.remove('hidden');
  } else {
    el.workingHours.textContent = t('booking_no_slots');
    el.workingHours.classList.remove('hidden');
    el.slotsEmptyState.classList.remove('hidden');
    return;
  }

  if (state.slots.length === 0) {
    el.slotsEmptyState.classList.remove('hidden');
    return;
  }

  for (const slot of state.slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isActive = state.selectedSlotStart?.getTime?.() === slot.startDate.getTime();
    btn.className = `slot-btn ${isActive ? 'active' : ''}`;
    btn.textContent = slot.label;
    btn.addEventListener('click', () => {
      state.selectedSlotStart = slot.startDate;
      state.selectedSlotEnd = slot.endDate;
      renderSlots();
      updateValidation();
    });
    el.slots.appendChild(btn);
  }
}

async function submitBooking(e) {
  e.preventDefault();
  if (el.submit.disabled) return;

  const clientName = el.name.value.trim();
  const clientPhone = el.phone.value.trim();
  const note = el.note.value.trim();

  const payload = {
    id: crypto.randomUUID().toLowerCase(),
    uid: state.uid,
    clientName,
    clientPhone,
    serviceId: state.selectedService.id,
    serviceName: state.selectedService.name,
    serviceDuration: state.selectedService.durationMinutes,
    startDate: Timestamp.fromDate(state.selectedSlotStart),
    endDate: Timestamp.fromDate(state.selectedSlotEnd),
    note: note || null,
    linkId: state.linkId,
    status: 'pending',
    createdAt: serverTimestamp(),
    isDeleted: false,
    updatedAt: serverTimestamp()
  };

  el.submit.disabled = true;
  try {
    const newId = crypto.randomUUID().toLowerCase();
    payload.id = newId;
    await setDoc(doc(db, `users/${state.uid}/pendingBookings`, newId), payload);
    await setDoc(doc(db, `users/${state.uid}/sloturiOcupate`, newId), {
      durataMinute: state.selectedService.durationMinutes,
      oraStart: Timestamp.fromDate(state.selectedSlotStart),
      linkId: state.linkId,
      isDeleted: false,
      updatedAt: serverTimestamp()
    });
    el.flow.classList.add('hidden');
    el.stepsContainer.classList.add('hidden');
    el.success.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showError(t('booking_error_submit'));
  } finally {
    updateValidation();
  }
}

const CURRENCY_SYMBOLS = {
  RON: 'lei', EUR: '€', GBP: '£', USD: '$', BRL: 'R$', CHF: 'Fr', HUF: 'Ft'
};

function formatPrice(amount, currencyCode) {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${formatted} ${symbol}`;
}

async function init() {
  // Ensure translations are loaded and applied
  if (window.applyLang && window.detectLang) {
    window.applyLang(window.detectLang());
  }

  try {
    const ok = await loadLink();
    if (!ok) return;

    // Load currency before rendering services so prices show the correct symbol.
    const bookingPublicSnap = await getDoc(doc(db, `users/${state.uid}/setari/bookingPublic`));
    if (bookingPublicSnap.exists()) {
      const bpData = bookingPublicSnap.data();
      if (bpData.currency) state.currency = bpData.currency;
    }

    await loadServices();

    el.dateInput.min = getMinDateISO();
    el.dateInput.value = getMinDateISO();
    state.selectedDate = el.dateInput.value;

    // Trigger date picker when clicking anywhere on the input or wrapper
    el.dateInput.parentElement.addEventListener('click', () => {
      if ('showPicker' in HTMLInputElement.prototype) {
        el.dateInput.showPicker();
      } else {
        el.dateInput.click();
      }
    });

    el.dateInput.addEventListener('change', async () => {
      state.selectedDate = el.dateInput.value;
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      await loadSlotsForSelectedDate();
      updateValidation();
    });

    el.name.addEventListener('input', updateValidation);
    el.phone.addEventListener('input', updateValidation);
    el.form.addEventListener('submit', submitBooking);
    
    // Navigation buttons
    el.toStep3.addEventListener('click', () => goToStep(3));
    el.backTo1.addEventListener('click', () => goToStep(1));
    el.backTo2.addEventListener('click', () => goToStep(2));

    // Listen for language changes to re-render dynamic parts
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        // Give i18n.js a moment to update localStorage
        setTimeout(() => {
          renderServices();
          renderSlots();
        }, 50);
      });
    });

    await loadSlotsForSelectedDate();
    showFlow();
    updateValidation();
  } catch (err) {
    console.error(err);
    if (err?.code === 'permission-denied') {
      showError(t('booking_error_link_disabled'));
    } else {
      showError(t('booking_error_load'));
    }
  }
}

void init();

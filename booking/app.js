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
  services: [],
  selectedService: null,
  selectedDate: null,
  selectedSlotStart: null,
  selectedSlotEnd: null,
  workingRange: null,
  slots: []
};

const el = {
  loading: document.getElementById('state-loading'),
  error: document.getElementById('state-error'),
  success: document.getElementById('state-success'),
  flow: document.getElementById('booking-flow'),
  services: document.getElementById('services'),
  dateInput: document.getElementById('booking-date'),
  workingHours: document.getElementById('working-hours'),
  slots: document.getElementById('slots'),
  form: document.getElementById('booking-form'),
  name: document.getElementById('client-name'),
  phone: document.getElementById('client-phone'),
  note: document.getElementById('client-note'),
  submit: document.getElementById('submit-btn')
};

function showError(message) {
  el.loading.classList.add('hidden');
  el.flow.classList.add('hidden');
  el.error.textContent = message;
  el.error.classList.remove('hidden');
}

function showFlow() {
  el.loading.classList.add('hidden');
  el.error.classList.add('hidden');
  el.flow.classList.remove('hidden');
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

function setSubmitEnabled() {
  const ok =
    !!state.selectedService &&
    !!state.selectedDate &&
    !!state.selectedSlotStart &&
    el.name.value.trim().length > 1 &&
    el.phone.value.trim().length >= 5;
  el.submit.disabled = !ok;
}

async function loadLink() {
  state.linkId = parseLinkId();
  if (!state.linkId) {
    showError('Invalid booking link.');
    return false;
  }

  const linkRef = doc(db, 'bookingLinks', state.linkId);
  const linkSnap = await getDoc(linkRef);
  if (!linkSnap.exists()) {
    showError('This booking link does not exist.');
    return false;
  }

  const data = linkSnap.data();
  const expiresAt = data.expiresAt?.toDate?.() || null;
  if (data.isDeleted || data.active === false) {
    showError('This booking link is disabled.');
    return false;
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    showError('This booking link has expired.');
    return false;
  }

  state.linkDoc = data;
  state.uid = data.uid;

  if (!state.uid) {
    showError('Invalid booking link owner.');
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
    .filter(s => (s.tipServiciu || 'STANDARD') !== 'SUBSCRIPTION')
    .map(s => ({
      id: s.id,
      name: s.nume || '',
      durationMinutes: Number(s.durataMinute || 0),
      price: Number(s.pret || 0)
    }))
    .filter(s => s.name && s.durationMinutes > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (state.services.length === 0) {
    showError('No bookable services are available for this provider.');
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
    btn.innerHTML = `
      <div class="service-main"><span>${svc.name}</span><span>${svc.durationMinutes} min</span></div>
      <div class="service-sub">${svc.price > 0 ? `${svc.price.toFixed(2)} €` : 'Price set in app'}</div>
    `;
    btn.addEventListener('click', () => {
      state.selectedService = svc;
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      renderServices();
      renderSlots();
      void loadSlotsForSelectedDate();
      setSubmitEnabled();
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

  const { start, end } = await loadWorkingRange(state.selectedDate);
  state.workingRange = { start, end };
  if (end <= start) {
    state.slots = [];
    renderSlots();
    return;
  }

  const busy = await loadBusySlots(state.selectedDate);
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
}

function renderSlots() {
  el.slots.innerHTML = '';

  if (!state.selectedService) {
    el.slots.innerHTML = '<p class="muted">Select a service first.</p>';
    el.workingHours.textContent = '';
    return;
  }

  if (!state.selectedDate) {
    el.slots.innerHTML = '<p class="muted">Select a date to see available slots.</p>';
    el.workingHours.textContent = '';
    return;
  }

  if (state.workingRange && state.workingRange.end > state.workingRange.start) {
    el.workingHours.textContent = `Working hours: ${fmtHHmmFromMinutes(state.workingRange.start)} - ${fmtHHmmFromMinutes(state.workingRange.end)}`;
  } else {
    el.workingHours.textContent = 'Not available on this day.';
  }

  if (state.slots.length === 0) {
    el.slots.innerHTML = '<p class="muted">No free slots available for this day.</p>';
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
      setSubmitEnabled();
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
    await addDoc(collection(db, `users/${state.uid}/pendingBookings`), payload);
    el.flow.classList.add('hidden');
    el.success.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showError('Could not send request. Please try again.');
  } finally {
    setSubmitEnabled();
  }
}

async function init() {
  try {
    const ok = await loadLink();
    if (!ok) return;

    await loadServices();

    el.dateInput.min = getMinDateISO();
    el.dateInput.value = getMinDateISO();
    state.selectedDate = el.dateInput.value;

    el.dateInput.addEventListener('change', async () => {
      state.selectedDate = el.dateInput.value;
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      await loadSlotsForSelectedDate();
      setSubmitEnabled();
    });

    el.name.addEventListener('input', setSubmitEnabled);
    el.phone.addEventListener('input', setSubmitEnabled);
    el.form.addEventListener('submit', submitBooking);

    await loadSlotsForSelectedDate();
    showFlow();
    setSubmitEnabled();
  } catch (err) {
    console.error(err);
    showError('Booking page failed to load.');
  }
}

void init();

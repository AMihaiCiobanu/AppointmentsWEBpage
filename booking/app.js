import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// These keys are intentionally public — Firebase web config is always client-visible.
// Security is enforced by Firestore Security Rules + App Check, not key secrecy.
// Restrict the API key to your domain in Google Cloud Console → APIs & Services → Credentials.
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
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LcieqUsAAAAAJi2J0k-aawVuqpArTNRx1iccCRr'),
  isTokenAutoRefreshEnabled: true
});

const db = getFirestore(app);

let cachedBookingPublic = null;
const slotsCache = new Map(); // key: dateISO, value: { timeOffRows, busySlots, fetchedAt }
// Class occurrences are fetched per service with an equality-only query (no composite index
// needed) and filtered by day here.
// Every upcoming class occurrence of this account, fetched once. Occurrences already held are
// never transferred: a weekly class accumulates one document per week forever.
let cachedUpcomingSessions = null; // { rows, fetchedAt }
const SLOTS_CACHE_TTL_MS = 30_000;

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
  selectedClassSessionId: '',
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
  dateDisplay: document.getElementById('booking-date-display'),
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

function showToast(message, durationMs = 4000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden', 'fade-out');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, durationMs);
}

function showError(message) {
  el.loading.classList.add('hidden');
  el.flow.classList.add('hidden');
  el.stepsContainer.classList.add('hidden');
  el.error.textContent = '';
  const msgP = document.createElement('p');
  msgP.textContent = message;
  const contactP = document.createElement('p');
  contactP.className = 'booking-error-contact';
  contactP.textContent = t('booking_error_contact');
  el.error.appendChild(msgP);
  el.error.appendChild(contactP);
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

const phoneRegex = /^\+?[\d\s\-]{7,20}$/;
function isPhoneValid(phone) {
  return phoneRegex.test(phone) && (phone.match(/\d/g) || []).length >= 7;
}

function updateValidation() {
  el.toStep3.disabled = !state.selectedSlotStart;

  const phoneValue = el.phone.value.trim();
  const phoneOk = isPhoneValid(phoneValue);
  const phoneErrorEl = document.getElementById('phone-error');
  if (phoneValue.length > 5) {
    phoneErrorEl.classList.toggle('hidden', phoneOk);
  }

  const nameValue = el.name.value.trim();
  const nameOk = nameValue.length > 1 && /\p{L}/u.test(nameValue);

  const ok =
    !!state.selectedService &&
    !!state.selectedDate &&
    !!state.selectedSlotStart &&
    nameOk &&
    phoneOk;
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


// Same grouping, order and wording as the Services screen in the apps.
const SERVICE_GROUPS = [
  { labelKey: 'booking_group_standard', className: 'service-group-standard', match: s => !s.isClass && !s.isSubscription },
  { labelKey: 'booking_group_subscriptions', className: 'service-group-subscription', match: s => s.isSubscription },
  { labelKey: 'booking_group_classes', className: 'service-group-class', match: s => s.isClass }
];

function renderServices() {
  el.services.innerHTML = '';

  const groups = SERVICE_GROUPS
    .map(group => ({ ...group, items: state.services.filter(group.match) }))
    .filter(group => group.items.length > 0);

  // One heading above the whole list would be noise: label the groups only once the list is
  // actually split into more than one.
  const showHeadings = groups.length > 1;

  for (const group of groups) {
    if (showHeadings) {
      const title = document.createElement('h3');
      title.className = `service-group-title ${group.className}`;
      title.textContent = t(group.labelKey);
      el.services.appendChild(title);
    }
    for (const svc of group.items) {
      el.services.appendChild(createServiceButton(svc));
    }
  }
}

function createServiceButton(svc) {
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
  btn.appendChild(mainDiv);
  if (svc.description) {
    const descDiv = document.createElement('div');
    descDiv.className = 'service-description';
    descDiv.textContent = svc.description;
    btn.appendChild(descDiv);
  }
  const subDiv = document.createElement('div');
  subDiv.className = 'service-sub';
  if (svc.showPrice) {
    subDiv.textContent = svc.price > 0 ? formatPrice(svc.price, state.currency) : t('booking_price_in_app');
  }
  btn.appendChild(subDiv);
  btn.addEventListener('click', () => {
    void selectService(svc);
  });
  return btn;
}

async function selectService(svc) {
  state.selectedService = svc;
  state.selectedSlotStart = null;
  state.selectedSlotEnd = null;
  state.selectedClassSessionId = '';
  renderServices();
  renderSlots();
  updateValidation();
  // Auto-advance to next step
  setTimeout(() => goToStep(2), 300);

  // A class runs on the owner's own schedule, so today is almost never the day it is held:
  // move the date field to its next occurrence rather than showing an empty list. A failed
  // read leaves the date where it was — the class is still bookable by picking the day.
  if (svc.isClass) {
    try {
      const dateISO = firstUpcomingSessionDateISO(await loadUpcomingClassSessions(), svc.id);
      // The client may have picked another service while the read was in flight.
      if (dateISO && state.selectedService?.id === svc.id && dateISO !== state.selectedDate) {
        state.selectedDate = dateISO;
        el.dateInput.value = dateISO;
        updateDateDisplay();
      }
    } catch { /* keep the current date */ }
    if (state.selectedService?.id !== svc.id) return;
  }

  try {
    await loadSlotsForSelectedDate();
  } catch { /* slots cleared by loadSlotsForSelectedDate's catch */ }
  updateValidation();
}

function toISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMinDateISO() {
  return toISODate(new Date());
}

function slotOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function loadWorkingRange(dateISO) {
  if (!cachedBookingPublic) {
    const snap = await getDoc(doc(db, `users/${state.uid}/setari/bookingPublic`));
    cachedBookingPublic = snap.exists() ? snap.data() : {};
  }
  if (!cachedBookingPublic || !Object.keys(cachedBookingPublic).length) return { start: 0, end: 0 };

  const set = cachedBookingPublic;
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
      return {
        start: startDate,
        end: endDate,
        serviceId: row.serviceId || '',
        classSessionId: row.classSessionId || '',
        // Missing field means blocking: docs written before this release, and by older
        // app versions, must keep holding their slot.
        blocking: row.blocking !== false
      };
    })
    .filter(Boolean);
}

// Docs that hold the slot for everybody (normal appointments, and the one doc a class
// occurrence writes for its own window).
function hardBusy(rows) {
  return rows.filter(r => r.blocking);
}

// Docs that block nobody else booking the SAME service, and only count towards a capacity.
// They still hold the slot against every other service — see slotTakenBy.
function capacityCounters(rows) {
  return rows.filter(r => !r.blocking);
}

function countForClassSession(rows, sessionId) {
  return capacityCounters(rows).filter(r => r.classSessionId === sessionId).length;
}

function countOverlappingForService(rows, serviceId, start, end) {
  return capacityCounters(rows).filter(
    r => r.serviceId === serviceId && slotOverlaps(start, end, r.start, r.end)
  ).length;
}

function isFull(enrolled, maxPeople) {
  return maxPeople > 0 && enrolled >= maxPeople;
}

// Is this window unavailable for `serviceId`? Blocking documents take it from everybody.
// A capacity counter takes it from everybody EXCEPT the service it was booked for: once a
// non-blocking service holds an hour, that hour belongs to it, and only more clients of the
// same service may share it (up to maxPeople). Booking a haircut into an hour already
// running a group class of another service would double-book the professional.
function slotTakenBy(rows, serviceId, start, end) {
  const overlaps = r => slotOverlaps(start, end, r.start, r.end);
  return hardBusy(rows).some(overlaps)
    || capacityCounters(rows).some(r => r.serviceId !== serviceId && overlaps(r));
}

async function loadUpcomingClassSessions() {
  if (cachedUpcomingSessions && Date.now() - cachedUpcomingSessions.fetchedAt < SLOTS_CACHE_TTL_MS) {
    return cachedUpcomingSessions.rows;
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const colRef = collection(db, `users/${state.uid}/classSessions`);
  // A range on one field only, so Firestore serves it from the automatic single-field index —
  // an equality on serviceId plus this range would need a composite index to be configured.
  // Filtering per service happens below, on a list that is already small.
  const qy = query(colRef, where('startDate', '>=', Timestamp.fromDate(dayStart)));
  const snap = await getDocs(qy);
  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(row => row.isDeleted !== true)
    .map(row => {
      const start = row.startDate?.toDate?.();
      const end = row.endDate?.toDate?.();
      if (!start || !end || end <= start) return null;
      return {
        id: row.id,
        serviceId: row.serviceId || '',
        start,
        end,
        maxPeople: Number(row.maxPeople || 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  cachedUpcomingSessions = { rows, fetchedAt: Date.now() };
  return rows;
}

function sessionsForService(rows, serviceId) {
  return rows.filter(row => row.serviceId === serviceId);
}

// The day the class actually runs next, so picking a class can move the date field there
// instead of leaving the client on a today that holds nothing. Same `start > now` test the
// slot builder uses, otherwise a class held earlier today would send them to an empty day.
function firstUpcomingSessionDateISO(rows, serviceId) {
  const now = new Date();
  const next = sessionsForService(rows, serviceId).find(row => row.start > now);
  return next ? toISODate(next.start) : null;
}

function sessionsOnDate(rows, dateISO) {
  const dayStart = toDayBoundary(dateISO, false);
  const dayEnd = toDayBoundary(dateISO, true);
  return rows.filter(r => r.start >= dayStart && r.start <= dayEnd);
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
    const cached = slotsCache.get(state.selectedDate);
    const isFresh = cached && (Date.now() - cached.fetchedAt < SLOTS_CACHE_TTL_MS);

    let workingRange, timeOffRows, busySlotsFromDB;
    if (isFresh) {
      ({ workingRange, timeOffRows, busySlots: busySlotsFromDB } = cached);
    } else {
      [workingRange, timeOffRows, busySlotsFromDB] = await Promise.all([
        loadWorkingRange(state.selectedDate),
        loadTimeOffsForDate(state.selectedDate),
        loadBusySlots(state.selectedDate)
      ]);
      slotsCache.set(state.selectedDate, { workingRange, timeOffRows, busySlots: busySlotsFromDB, fetchedAt: Date.now() });
    }

    state.workingRange = workingRange;
    const { start, end } = workingRange;

    if (end <= start && !state.selectedService.isClass) {
      state.slots = [];
      renderSlots();
      return;
    }

    if (isFullDayTimeOff(timeOffRows)) {
      state.workingRange = { start: 0, end: 0 };
      state.slots = [];
      renderSlots();
      return;
    }

    const now = new Date();

    // A class is not a grid of slots: it runs when the owner scheduled it, and the only
    // thing that can close it is its capacity. Overlapping appointments are the owner's
    // business — hiding the class because of one would leave clients with nothing to book.
    if (state.selectedService.isClass) {
      const upcoming = sessionsForService(await loadUpcomingClassSessions(), state.selectedService.id);
      const sessionRows = sessionsOnDate(upcoming, state.selectedDate);
      state.slots = sessionRows
        .filter(session => session.start > now)
        .map(session => {
          const enrolled = countForClassSession(busySlotsFromDB, session.id);
          return {
            startDate: session.start,
            endDate: session.end,
            classSessionId: session.id,
            full: isFull(enrolled, session.maxPeople),
            label: `${String(session.start.getHours()).padStart(2, '0')}:${String(session.start.getMinutes()).padStart(2, '0')}`
          };
        });
      renderSlots();
      return;
    }

    const timeOffBusy = partialTimeOffBusySlots(timeOffRows);
    const duration = state.selectedService.durationMinutes;
    const interval = 30;

    const [y, m, d] = state.selectedDate.split('-').map(Number);
    const dayBase = new Date(y, m - 1, d, 0, 0, 0, 0);

    const slots = [];
    for (let startMin = start; startMin + duration <= end; startMin += interval) {
      const slotStart = new Date(dayBase.getTime() + startMin * 60000);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      if (slotStart <= now) continue;

      const blocked = timeOffBusy.some(b => slotOverlaps(slotStart, slotEnd, b.start, b.end))
        || slotTakenBy(busySlotsFromDB, state.selectedService.id, slotStart, slotEnd);
      if (blocked) continue;

      // A service that does not hold the slot can still have a cap. The slot is shown as
      // full rather than hidden, so the client can see why it is not available.
      let full = false;
      if (state.selectedService.maxPeople > 0) {
        const taken = countOverlappingForService(
          busySlotsFromDB, state.selectedService.id, slotStart, slotEnd
        );
        full = isFull(taken, state.selectedService.maxPeople);
      }

      slots.push({
        startDate: slotStart,
        endDate: slotEnd,
        classSessionId: '',
        full,
        label: `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
      });
    }

    state.slots = slots;
    renderSlots();
  } catch (err) {
    state.slots = [];
    renderSlots();
    throw err;
  } finally {
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

  // A class runs on its own schedule, so the day's working window says nothing about it.
  if (state.selectedService.isClass) {
    if (state.slots.length === 0) {
      el.workingHours.textContent = t('booking_no_class_sessions');
      el.workingHours.classList.remove('hidden');
      el.slotsEmptyState.classList.remove('hidden');
      return;
    }
  } else if (state.workingRange && state.workingRange.end > state.workingRange.start) {
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
    // Full slots stay on the page, disabled: a missing slot looks like a mistake, a
    // "Class Full" one explains itself.
    btn.className = `slot-btn ${isActive ? 'active' : ''} ${slot.full ? 'full' : ''}`;
    btn.disabled = !!slot.full;
    btn.textContent = slot.full
      ? `${slot.label} · ${state.selectedService.isClass ? t('booking_class_full') : t('booking_slot_full')}`
      : slot.label;
    if (!slot.full) {
      btn.addEventListener('click', () => {
        state.selectedSlotStart = slot.startDate;
        state.selectedSlotEnd = slot.endDate;
        state.selectedClassSessionId = slot.classSessionId || '';
        renderSlots();
        updateValidation();
      });
    }
    el.slots.appendChild(btn);
  }
}

async function submitBooking(e) {
  e.preventDefault();
  if (el.submit.disabled) return;

  const clientName = el.name.value.trim();
  const clientPhone = el.phone.value.trim();
  const note = el.note.value.trim();

  const durationMinutes = Math.max(
    1,
    Math.round((state.selectedSlotEnd - state.selectedSlotStart) / 60000)
  );
  const classSessionId = state.selectedClassSessionId || '';

  const payload = {
    uid: state.uid,
    clientName,
    clientPhone,
    serviceId: state.selectedService.id,
    serviceName: state.selectedService.name,
    // A class runs for as long as the owner scheduled it, which need not equal the
    // service duration.
    serviceDuration: state.selectedService.isClass ? durationMinutes : state.selectedService.durationMinutes,
    classSessionId,
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
    await getToken(appCheck, /* forceRefresh */ true);

    // Re-fetch immediately before writing to catch concurrent bookings. A class checks its
    // capacity instead of the wall clock — its own blocking doc would always "conflict".
    const freshBusy = await loadBusySlots(state.selectedDate);
    let conflict;
    if (state.selectedService.isClass) {
      const session = sessionsOnDate(sessionsForService(await loadUpcomingClassSessions(), state.selectedService.id), state.selectedDate)
        .find(row => row.id === classSessionId);
      conflict = !session || isFull(countForClassSession(freshBusy, classSessionId), session.maxPeople);
    } else {
      conflict = slotTakenBy(
        freshBusy, state.selectedService.id, state.selectedSlotStart, state.selectedSlotEnd
      ) || (state.selectedService.maxPeople > 0 && isFull(
        countOverlappingForService(
          freshBusy, state.selectedService.id, state.selectedSlotStart, state.selectedSlotEnd
        ),
        state.selectedService.maxPeople
      ));
    }
    if (conflict) {
      slotsCache.delete(state.selectedDate);
      cachedUpcomingSessions = null;
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      state.selectedClassSessionId = '';
      goToStep(2);
      await loadSlotsForSelectedDate();
      showToast(t('booking_error_slot_taken'));
      return;
    }

    const newId = crypto.randomUUID().toLowerCase();
    payload.id = newId;
    const batch = writeBatch(db);
    batch.set(doc(db, `users/${state.uid}/pendingBookings`, newId), payload);
    batch.set(doc(db, `users/${state.uid}/sloturiOcupate`, newId), {
      durataMinute: payload.serviceDuration,
      oraStart: Timestamp.fromDate(state.selectedSlotStart),
      serviceId: state.selectedService.id,
      classSessionId,
      // A class enrollment and a non-blocking service only count towards a capacity; the
      // class window is already held by the occurrence's own doc.
      blocking: !classSessionId && state.selectedService.occupiesSlot,
      linkId: state.linkId,
      isDeleted: false,
      updatedAt: serverTimestamp()
    });
    await batch.commit();
    el.flow.classList.add('hidden');
    el.stepsContainer.classList.add('hidden');
    el.success.classList.remove('hidden');
  } catch {
    showError(t('booking_error_submit'));
  } finally {
    updateValidation();
  }
}

const CURRENCY_SYMBOLS = {
  RON: 'lei', EUR: '€', GBP: '£', USD: '$', BRL: 'R$', CHF: 'Fr', HUF: 'Ft', BGN: 'лв', PLN: 'zł',
  INR: '₹', TRY: '₺', SEK: 'kr', NOK: 'kr', DKK: 'kr', CZK: 'Kč', AED: 'د.إ',
  RUB: '₽', KZT: '₸', KGS: 'с', UZS: "so'm"
};

function formatPrice(amount, currencyCode) {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${formatted} ${symbol}`;
}

function updateDateDisplay() {
  const val = el.dateInput.value;
  if (!val) {
    el.dateDisplay.textContent = '--/--/----';
    return;
  }
  const [y, m, d] = val.split('-');
  el.dateDisplay.textContent = `${d}/${m}/${y}`;
}

async function init() {
  if (window.applyLang && window.detectLang) {
    window.applyLang(window.detectLang());
  }

  try {
    // Fire App Check pre-warm without blocking — enforcement is off, don't wait on it
    getToken(appCheck, false).catch(() => {});

    const ok = await loadLink();
    if (!ok) return;

    // Parallel: fetch currency settings and services in one round trip
    const [bookingPublicSnap, servicesSnap] = await Promise.all([
      getDoc(doc(db, `users/${state.uid}/setari/bookingPublic`)),
      getDocs(collection(db, `users/${state.uid}/servicii`))
    ]);

    if (bookingPublicSnap.exists()) {
      cachedBookingPublic = bookingPublicSnap.data();
      if (cachedBookingPublic.currency) state.currency = cachedBookingPublic.currency;
    }

    state.services = servicesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.isDeleted !== true && s.showService !== false)
      .map(s => ({
        id: s.id,
        name: s.nume || '',
        durationMinutes: Number(s.durataMinute || 0),
        price: Number(s.pret || 0),
        showPrice: s.showPrice !== false,
        description: s.serviceDescription || '',
        isClass: s.tipServiciu === 'CLASS',
        isSubscription: s.tipServiciu === 'SUBSCRIPTION',
        // Missing means "holds the slot", so services written by older clients keep
        // behaving exactly as before.
        occupiesSlot: s.occupiesSlot !== false,
        maxPeople: Number(s.maxPeople || 0)
      }))
      .filter(s => s.name && s.durationMinutes > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // A class whose whole series has already been held cannot be booked on any date, so it is
    // not offered at all. The apps keep such a class in the owner's catalog for a while; here
    // it would only be a dead end. A failed read leaves the list untouched rather than hiding
    // classes that are perfectly bookable.
    if (state.services.some(s => s.isClass)) {
      try {
        const bookable = new Set((await loadUpcomingClassSessions()).map(row => row.serviceId));
        state.services = state.services.filter(s => !s.isClass || bookable.has(s.id));
      } catch { /* keep every class listed */ }
    }

    if (state.services.length === 0) {
      showError(t('booking_error_no_services'));
      return;
    }

    renderServices();

    const todayISO = getMinDateISO();
    el.dateInput.min = todayISO;
    el.dateInput.value = todayISO;
    state.selectedDate = todayISO;
    updateDateDisplay();

    const dateWrapper = el.dateInput.parentElement;
    if (dateWrapper) {
      dateWrapper.addEventListener('click', () => {
        if ('showPicker' in HTMLInputElement.prototype) {
          el.dateInput.showPicker();
        } else {
          el.dateInput.click();
        }
      });
    }

    el.dateInput.addEventListener('change', async () => {
      state.selectedDate = el.dateInput.value;
      updateDateDisplay();
      state.selectedSlotStart = null;
      state.selectedSlotEnd = null;
      state.selectedClassSessionId = '';
      try {
        await loadSlotsForSelectedDate();
      } catch { /* slots cleared by loadSlotsForSelectedDate's catch */ }
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
    if (err?.code === 'permission-denied') {
      showError(t('booking_error_link_disabled'));
    } else {
      showError(t('booking_error_load'));
    }
  }
}

void init();

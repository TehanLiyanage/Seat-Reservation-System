const API_BASE = "https://seat-reservation-system-frpd.onrender.com";

const $ = (q) => document.querySelector(q);

// ---------------- API HELPER ----------------
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------------- TOGGLE UI ----------------
function toggleAdminApp(showDashboard) {
  if (showDashboard) {
    $('#aAuth').classList.add('hidden');   // hide login
    $('#aApp').classList.remove('hidden'); // show dashboard
    $('#btnALogout').classList.remove('hidden'); // ✅ show logout
  } else {
    $('#aAuth').classList.remove('hidden'); // show login
    $('#aApp').classList.add('hidden');     // hide dashboard
    $('#btnALogout').classList.add('hidden'); // ✅ hide logout
  }
}

// ---------------- AUTH ----------------
$('#btnALogin').onclick = async () => {
  try {
    await api('/auth/login', { 
      method: 'POST', 
      body: { 
        email: $('#aEmail').value, 
        password: $('#aPassword').value 
      } 
    });

    const me = await api('/auth/me');
    if (me.user.role !== 'admin') throw new Error('Not an admin account');

    toggleAdminApp(true);   // ✅ show dashboard explicitly
    loadSeats();            // preload seats list
    loadInterns();          // populate intern dropdown
    loadSeatsDropdown();    // populate seat dropdown
  } catch (e) { 
    alert(e.message); 
  }
};

$('#btnALogout').onclick = async () => { 
  try {
    await api('/auth/logout', { method: 'POST' }); 
  } finally {
    toggleAdminApp(false);  // ✅ switch back to login
    location.reload();      // hard refresh ensures no stale session
  }
};

// ---------------- SEATS ----------------
async function loadSeats() {
  const list = await api('/seats');
  const wrap = $('#aSeats'); 
  wrap.innerHTML = '';

  list.forEach(s => {
    const div = document.createElement('div'); 
    div.className = 'row';
    div.innerHTML = `
      <div>#${s.id} <b>${s.seat_number}</b> – ${s.location || ''} – ${s.status} – ${s.branch || ''}</div>
      <div>
        <button data-edit>Edit</button>
        <button class="danger" data-del>Delete</button>
      </div>`;

    // Edit seat
    div.querySelector('[data-edit]').onclick = async () => {
      const seat_number = prompt('Seat number', s.seat_number);
      const location = prompt('Location', s.location || '');
      const status = prompt('Status (available/unavailable)', s.status);
      const branch = prompt('Branch', s.branch || '');
      try { 
        await api(`/seats/${s.id}`, { 
          method: 'PUT', 
          body: { seat_number, location, status, branch } 
        }); 
        loadSeats();
        loadSeatsDropdown();
      } catch (e) { 
        alert(e.message); 
      }
    };

    // Delete seat
    div.querySelector('[data-del]').onclick = async () => {
      if (!confirm('Delete seat?')) return;
      try { 
        await api(`/seats/${s.id}`, { method: 'DELETE' }); 
        loadSeats();
        loadSeatsDropdown();
      } catch (e) { 
        alert(e.message); 
      }
    };

    wrap.appendChild(div);
  });
}

$('#btnLoadSeats').onclick = () => { loadSeats(); loadSeatsDropdown(); };

$('#btnAddSeat').onclick = async () => {
  try {
    await api('/seats', { 
      method: 'POST', 
      body: {
        seat_number: $('#seatNumber').value,
        location: $('#seatLocation').value,
        status: $('#seatStatus').value,
        branch: $('#seatBranch').value
      }
    });
    loadSeats();
    loadSeatsDropdown();
  } catch (e) { 
    alert(e.message); 
  }
};

// ---------------- RESERVATIONS ----------------
async function loadReservations() {
  const d = $('#rDate').value; 
  const intern = $('#rInternId').value;
  const q = new URLSearchParams(); 
  if (d) q.set('date', d); 
  if (intern) q.set('intern_id', intern);

  const list = await api(`/admin/reservations?${q.toString()}`);
  const wrap = $('#aReservations'); 
  wrap.innerHTML = '';

  list.forEach(r => {
    const div = document.createElement('div'); 
    div.className = 'row';
    div.innerHTML = `
      <div>
        #${r.reservation_id} – InternID: ${r.intern_id} – ${r.date} – ${r.time_slot} – 
        Seat ${r.seat_number} (${r.location || ''}) – ${r.intern_name || 'Unknown'} (${r.intern_email || 'No email'}) – ${r.status}
      </div>`;
    wrap.appendChild(div);
  });
}
$('#btnLoadReservations').onclick = loadReservations;

// ---------------- MANUAL ASSIGN ----------------
async function manualAssign() {
  try {
    const internId = $('#mIntern').value;
    const seatId = $('#mSeat').value;
    if (!internId || !seatId) return alert("Please select both intern and seat");

    await api('/admin/reservations/assign', { 
      method: 'POST', 
      body: {
        intern_id: parseInt(internId, 10),
        seat_id: parseInt(seatId, 10),
        date: $('#mDate').value,
        time_slot: $('#mSlot').value
      }
    });
    alert('Assigned'); 
    loadReservations();
  } catch (e) { 
    alert("Assign failed: " + e.message); 
  }
}
$('#btnManualAssign').onclick = manualAssign;

// ---------------- INTERN DROPDOWN ----------------
async function loadInterns() {
  try {
    const interns = await api('/admin/users');
    const select = $('#mIntern');
    select.innerHTML = '<option value="">-- Select Intern --</option>';
    interns.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = `${i.name} (${i.email})`;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load interns:", e);
  }
}

// ---------------- SEAT DROPDOWN ----------------
async function loadSeatsDropdown() {
  try {
    const seats = await api('/seats');
    const select = $('#mSeat');
    select.innerHTML = '<option value="">-- Select Seat --</option>';
    seats.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.seat_number} (${s.location || ''}) – ${s.status}`;
      if (s.status !== 'available') opt.disabled = true;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load seats:", e);
  }
}

// ---------------- REPORTS ----------------
async function generateReport() {
  const from = $('#repFrom').value; 
  const to = $('#repTo').value;
  if (!from || !to) return alert('Pick dates');

  const rows = await api(`/admin/reports/usage?from=${from}&to=${to}`);
  const wrap = $('#aReport'); 
  wrap.innerHTML = '';

  rows.forEach(x => {
    const div = document.createElement('div'); 
    div.className = 'row';

    // ✅ If no reservations, show "No reservations"
    const text = (x.reserved === 0)
      ? "No reservations"
      : `${x.reserved}/${x.total} (${x.occupancy_pct}%)`;

    div.innerHTML = `<div><b>${x.date}</b> – ${x.time_slot}</div><div>${text}</div>`;
    wrap.appendChild(div);
  });
}
$('#btnReport').onclick = generateReport;

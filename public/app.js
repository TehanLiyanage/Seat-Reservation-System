const API_BASE = "https://seat-reservation-system-frpd.onrender.com/api";

// ---------------- SHORTCUT ----------------
const $ = (q) => document.querySelector(q);
const seatsDiv = $('#seats');
const myResDiv = $('#myReservations');

// ---------------- TOGGLE ----------------
const showAuth = (show) => {
  if (show) {
    // Show login/register form, hide app
    $('#auth').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#btnLogout').classList.add('hidden');
  } else {
    // Show app, hide login/register form
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#btnLogout').classList.remove('hidden');
  }
};

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

// ---------------- RESERVATIONS ----------------
async function loadMyReservations() {
  try {
    const { current, past } = await api('/reservations/me');
    myResDiv.innerHTML = '';

    // --- Current Reservations ---
    const curHeader = document.createElement('h3');
    curHeader.textContent = "Current Reservations";
    myResDiv.appendChild(curHeader);

    if (!current.length) {
      myResDiv.appendChild(document.createTextNode("No current reservations"));
    } else {
      current.forEach(r => {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
          <div>
            ${r.date} – ${r.time_slot} – Seat ${r.seat_number} (${r.status})
          </div>
          <div>
            <button class="secondary" data-action="modify">Modify</button>
            <button class="danger" data-action="cancel">Cancel</button>
          </div>`;

        // Cancel
        div.querySelector('[data-action="cancel"]').onclick = async () => {
          try {
            await api(`/reservations/${r.id}`, { method: 'DELETE' });
            loadMyReservations();
          } catch (e) {
            alert(e.message);
          }
        };

        // Modify
        div.querySelector('[data-action="modify"]').onclick = async () => {
          try {
            const seats = await api(`/seats?date=${r.date}&time_slot=${r.time_slot}`);

            div.innerHTML = `
              <div>
                <input type="date" value="${r.date}" id="editDate-${r.id}">
                <select id="editSlot-${r.id}">
                  <option value="MORNING" ${r.time_slot === 'MORNING' ? 'selected' : ''}>MORNING</option>
                  <option value="AFTERNOON" ${r.time_slot === 'AFTERNOON' ? 'selected' : ''}>AFTERNOON</option>
                  <option value="EVENING" ${r.time_slot === 'EVENING' ? 'selected' : ''}>EVENING</option>
                </select>
                <select id="editSeat-${r.id}">
                  ${seats.map(s =>
                    `<option value="${s.id}" ${s.seat_number === r.seat_number ? 'selected' : ''} ${!s.is_available && s.seat_number !== r.seat_number ? 'disabled' : ''}>
                      ${s.seat_number} (${s.location || ''}) ${!s.is_available && s.seat_number !== r.seat_number ? '(unavailable)' : ''}
                    </option>`
                  ).join('')}
                </select>
              </div>
              <div>
                <button class="success" data-action="save">Save</button>
                <button class="secondary" data-action="cancelEdit">Cancel</button>
              </div>
            `;

            // Save update
            div.querySelector('[data-action="save"]').onclick = async () => {
              const newDate = document.getElementById(`editDate-${r.id}`).value;
              const newSlot = document.getElementById(`editSlot-${r.id}`).value;
              const newSeat = document.getElementById(`editSeat-${r.id}`).value;

              if (!newDate || !newSlot || !newSeat) {
                alert("All fields required");
                return;
              }

              try {
                await api(`/reservations/${r.id}`, {
                  method: 'PUT',
                  body: { seat_id: parseInt(newSeat, 10), date: newDate, time_slot: newSlot }
                });
                alert("Reservation updated!");
                loadMyReservations();
              } catch (e) {
                alert(e.message);
              }
            };

            // Cancel edit
            div.querySelector('[data-action="cancelEdit"]').onclick = () => {
              loadMyReservations();
            };
          } catch (e) {
            alert("Failed to load seats: " + e.message);
          }
        };

        myResDiv.appendChild(div);
      });
    }

    // --- Past Reservations ---
    const pastHeader = document.createElement('h3');
    pastHeader.textContent = "Past Reservations";
    myResDiv.appendChild(pastHeader);

    if (!past.length) {
      myResDiv.appendChild(document.createTextNode("No past reservations"));
    } else {
      past.forEach(r => {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
          <div>
            ${r.date} – ${r.time_slot} – Seat ${r.seat_number} (${r.status})
          </div>`;
        myResDiv.appendChild(div);
      });
    }
  } catch (e) {
    myResDiv.textContent = e.message;
  }
}

// ---------------- AUTH ----------------
async function me() {
  try {
    await api('/auth/me');
    showAuth(false); // hide login, show app
    loadMyReservations();
  } catch {
    showAuth(true); // show login
  }
}

$('#btnLogin').onclick = async () => {
  try {
    await api('/auth/login', {
      method: 'POST',
      body: { email: $('#loginEmail').value, password: $('#loginPassword').value }
    });
    showAuth(false); // hide login, show app
    loadMyReservations();
  } catch (e) {
    alert(e.message);
  }
};

$('#btnRegister').onclick = async () => {
  try {
    await api('/auth/register', {
      method: 'POST',
      body: {
        name: $('#regName').value,
        email: $('#regEmail').value,
        password: $('#regPassword').value
      }
    });
    showAuth(false); // hide login, show app
    loadMyReservations();
  } catch (e) {
    alert(e.message);
  }
};

$('#btnLogout').onclick = async () => {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  } finally {
    alert("Logged out!");
    showAuth(true); // show login
    location.reload();
  }
};

// ---------------- SEATS ----------------
$('#btnLoadSeats').onclick = async () => {
  try {
    const d = $('#date').value;
    const slot = $('#slot').value;
    if (!d) return alert('Pick a date');

    const seats = await api(`/seats?date=${d}&time_slot=${slot}`);
    seatsDiv.innerHTML = '';

    seats.forEach(s => {
      const div = document.createElement('div');
      div.className = 'seat ' + (s.is_available ? 'ok' : 'busy');
      div.innerHTML = `
        <strong>${s.seat_number}</strong>
        <small>${s.location || ''}</small>
        <button ${s.is_available ? '' : 'disabled'}>Book</button>`;

      div.querySelector('button').onclick = async () => {
        try {
          await api('/reservations', {
            method: 'POST',
            body: { seat_id: s.id, date: d, time_slot: slot }
          });
          alert('Booked!');
          loadMyReservations();
          $('#btnLoadSeats').click();
        } catch (e) {
          alert(e.message);
        }
      };
      seatsDiv.appendChild(div);
    });
  } catch (e) {
    alert(e.message);
  }
};

// ---------------- INITIAL ----------------
me();

// Smart Expense Tracker: PDF export + budget alerts + charts
// Requires: Chart.js, html2canvas, jspdf

/* ---------------------- Helpers & Selectors ---------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Pages
const pages = {
  home: $('#home-page'),
  signup: $('#signup-page'),
  login: $('#login-page'),
  dashboard: $('#dashboard-page')
};

function showPage(name){
  Object.values(pages).forEach(p=>p.classList.remove('active'));
  pages[name].classList.add('active');
}

/* Date helpers */
const todayISO = () => new Date().toISOString().slice(0,10);
const monthKey = d => d.slice(0,7);
const currentMonthKey = () => monthKey(todayISO());

/* Storage helpers */
const USERS_KEY = 'users';
const CUR_USER_EMAIL_KEY = 'currentUser';
const loadUsers = () => JSON.parse(localStorage.getItem(USERS_KEY)||'[]');
const saveUsers = arr => localStorage.setItem(USERS_KEY, JSON.stringify(arr));
const setCurrentUserEmail = email => { if(email) localStorage.setItem(CUR_USER_EMAIL_KEY, email.toLowerCase()); else localStorage.removeItem(CUR_USER_EMAIL_KEY); }
const getCurrentUserEmail = () => localStorage.getItem(CUR_USER_EMAIL_KEY) || null;
const expKey = email => `expenses_${email.toLowerCase()}`;
const sbKey = (email, yymm) => `startbal_${email.toLowerCase()}_${yymm}`;
const budgetKey = (email, yymm) => `budget_${email.toLowerCase()}_${yymm}`;

/* App state */
let users = loadUsers();
let currentUserEmail = getCurrentUserEmail();
let currentUser = currentUserEmail ? users.find(u=>u.email===currentUserEmail) : null;
let expenses = currentUser ? JSON.parse(localStorage.getItem(expKey(currentUserEmail))||'[]') : [];

/* Charts */
let categoryChart = null, weeklyChart = null;

/* ---------------------- Navigation ---------------------- */
$('#go-login').addEventListener('click', ()=> showPage('login'));
$('#go-signup').addEventListener('click', ()=> showPage('signup'));
$('#to-login-from-signup').addEventListener('click', ()=> showPage('login'));
$('#to-signup-from-login').addEventListener('click', ()=> showPage('signup'));
$$('.back-home').forEach(b=>b.addEventListener('click', ()=> showPage('home')));

/* ---------------------- Signup ---------------------- */
$('#signup-form').addEventListener('submit', e => {
  e.preventDefault();
  const firstName = $('#first-name').value.trim();
  const lastName = $('#last-name').value.trim();
  const email = $('#signup-email').value.trim().toLowerCase();
  const phone = $('#phone').value.trim();
  const gender = $('#gender').value;
  const password = $('#signup-password').value;
  const startingBalance = parseFloat($('#signup-starting-balance').value || '0');

  users = loadUsers();
  if(users.some(u=>u.email===email)){ alert('Email already used'); return; }

  const user = { firstName, lastName, email, phone, gender, password };
  users.push(user);
  saveUsers(users);

  // initialize expenses and starting balance for the current month
  localStorage.setItem(expKey(email), JSON.stringify([]));
  localStorage.setItem(sbKey(email, currentMonthKey()), String(isNaN(startingBalance)?0:startingBalance));

  alert('Signup successful! Please login.');
  e.target.reset();
  showPage('login');
});

/* ---------------------- Login ---------------------- */
$('#login-form').addEventListener('submit', e=>{
  e.preventDefault();
  const email = $('#login-email').value.trim().toLowerCase();
  const password = $('#login-password').value;
  users = loadUsers();
  const user = users.find(u=>u.email===email && u.password===password);
  if(!user){ alert('Invalid credentials'); return; }
  currentUserEmail = user.email;
  currentUser = user;
  setCurrentUserEmail(currentUserEmail);
  onLogin();
  $('#login-form').reset();
});

/* ---------------------- Forgot Password Modal ---------------------- */
$('#forgot-link').addEventListener('click', ()=> $('#fp-overlay').hidden = false);
$('#fp-cancel').addEventListener('click', ()=> $('#fp-overlay').hidden = true);
$('#forgot-form').addEventListener('submit', e=>{
  e.preventDefault();
  const email = $('#forgot-email').value.trim().toLowerCase();
  const newpass = $('#forgot-newpass').value;
  users = loadUsers();
  const idx = users.findIndex(u=>u.email===email);
  if(idx===-1){ alert('No account found'); return; }
  users[idx].password = newpass;
  saveUsers(users);
  alert('Password reset. Please login.');
  $('#fp-overlay').hidden = true;
  showPage('login');
  e.target.reset();
});

/* ---------------------- On Login ---------------------- */
function onLogin(){
  showPage('dashboard');
  users = loadUsers();
  currentUser = users.find(u=>u.email===currentUserEmail);
  if(!currentUser) { setCurrentUserEmail(null); showPage('home'); return; }
  // load expenses for user
  expenses = JSON.parse(localStorage.getItem(expKey(currentUser.email)) || '[]');
  renderProfile();
  ensureStartingBalance();
  ensureTodayEntry();
  renderAll();
  if($('#expense-date')) $('#expense-date').value = todayISO();
}

/* ---------------------- Profile & Starting Balance ---------------------- */
function renderProfile(){
  $('#profile-name').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
  $('#profile-email').textContent = currentUser.email;
  $('#profile-phone').textContent = currentUser.phone;
  $('#month-label').textContent = `Month: ${currentMonthKey()}`;
}

function ensureStartingBalance(){
  const key = sbKey(currentUser.email, currentMonthKey());
  if(localStorage.getItem(key) === null) localStorage.setItem(key,'0');
  $('#set-starting-balance').value = localStorage.getItem(key) || '0';
}

/* Save starting balance */
$('#save-starting-balance').addEventListener('click', ()=>{
  const v = parseFloat($('#set-starting-balance').value || '0');
  localStorage.setItem(sbKey(currentUser.email,currentMonthKey()), String(isNaN(v)?0:v));
  renderStats();
  alert('Starting balance updated.');
});

/* Budget storage */
$('#save-month-budget').addEventListener('click', ()=>{
  const v = parseFloat($('#set-month-budget').value || '0');
  localStorage.setItem(budgetKey(currentUser.email, currentMonthKey()), String(isNaN(v)?0:v));
  renderStats();
  alert('Budget updated for this month.');
});

/* ---------------------- Ensure Today Entry ---------------------- */
function ensureTodayEntry(){
  const t = todayISO();
  const hasToday = expenses.some(e => e.date === t);
  if(!hasToday){
    const auto = { id: Date.now()+Math.floor(Math.random()*1000), name:'No Expense', amount:0, category:'None', date:t, auto:true };
    expenses.push(auto);
    saveExpenses();
    $('#reminder-banner').hidden = false;
    $('#banner-text').textContent = 'No expenses added today — a 0-amount entry was created.';
  } else $('#reminder-banner').hidden = true;
}
$('#banner-dismiss').addEventListener('click', ()=> $('#reminder-banner').hidden = true);

/* ---------------------- Expenses CRUD ---------------------- */
function loadExpenses(){ expenses = JSON.parse(localStorage.getItem(expKey(currentUser.email)) || '[]'); }
function saveExpenses(){ localStorage.setItem(expKey(currentUser.email), JSON.stringify(expenses)); }

$('#expense-form').addEventListener('submit', e=>{
  e.preventDefault();
  if(!currentUser){ alert('Login first'); return; }
  const name = $('#expense-name').value.trim(); const amount = parseFloat($('#expense-amount').value || '0');
  const category = $('#expense-category').value; const date = $('#expense-date').value || todayISO();
  if(!name){ alert('Enter name'); return; }
  if(isNaN(amount)){ alert('Enter valid amount'); return; }
  const item = { id: Date.now()+Math.floor(Math.random()*1000), name, amount: isNaN(amount)?0:amount, category, date, auto:false };
  expenses.push(item); saveExpenses(); renderAll(); e.target.reset();
  if(date===todayISO()) $('#reminder-banner').hidden = true;
});

/* Delete expense by id */
window.deleteExpense = function(id, btn){
  const row = btn.closest('tr');
  row.classList.add('removed');
  row.addEventListener('animationend', ()=>{
    const idx = expenses.findIndex(x=>x.id===id);
    if(idx>-1) expenses.splice(idx,1);
    saveExpenses(); renderAll();
  }, { once:true });
};

/* ---------------------- Render Table & Stats & Charts ---------------------- */
function renderTable(){
  const tbody = $('#expense-table-body'); tbody.innerHTML='';
  const rows = [...expenses].sort((a,b)=> a.date===b.date ? b.id-a.id : (a.date < b.date ? 1 : -1));
  rows.forEach(exp=>{
    const tr = document.createElement('tr'); tr.classList.add('added');
    tr.innerHTML = `<td>${escapeHtml(exp.name)}</td>
                    <td>৳ ${Number(exp.amount).toFixed(2)}</td>
                    <td>${escapeHtml(exp.category)}</td>
                    <td>${escapeHtml(exp.date)}</td>
                    <td><button class="btn-light" onclick="deleteExpense(${exp.id}, this)">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderTotals(){
  const grand = expenses.reduce((s,e)=> s + Number(e.amount||0), 0);
  $('#total-amount').textContent = grand.toFixed(2);
}

function renderStats(){
  const yymm = currentMonthKey();
  const sb = parseFloat(localStorage.getItem(sbKey(currentUser.email, yymm)) || '0');
  const monthTotal = expenses.filter(e=> monthKey(e.date)===yymm ).reduce((s,e)=> s + Number(e.amount||0), 0);
  const remaining = sb - monthTotal;
  $('#stat-starting-balance').textContent = sb.toFixed(2);
  $('#stat-total-month').textContent = monthTotal.toFixed(2);
  $('#stat-remaining').textContent = remaining.toFixed(2);

  // budget alert
  const budget = parseFloat(localStorage.getItem(budgetKey(currentUser.email,yymm)) || '0');
  if(budget > 0 && monthTotal >= budget){
    $('#budget-alert').hidden = false;
  } else $('#budget-alert').hidden = true;
}
$('#budget-dismiss').addEventListener('click', ()=> $('#budget-alert').hidden = true);

function updateCharts(){
  const catTotals = {}; const weekTotals = [0,0,0,0,0,0,0];
  expenses.forEach(e=>{
    catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount||0);
    const d = new Date(e.date).getDay(); weekTotals[d] += Number(e.amount||0);
  });

  const catLabels = Object.keys(catTotals); const catData = Object.values(catTotals);
  if(categoryChart) categoryChart.destroy();
  categoryChart = new Chart($('#categoryChart'), {
    type:'pie', data:{ labels: catLabels, datasets:[{ data: catData, backgroundColor:['#ff6384','#36a2eb','#ffcd56','#4bc0c0','#7c4dff'] }] }
  });

  if(weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart($('#weeklyChart'), {
    type:'bar', data:{ labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets:[{ label:'Weekly', data: weekTotals, backgroundColor:'#2563eb' }] },
    options:{ scales:{ y:{ beginAtZero:true } } }
  });
}

function renderAll(){ renderTable(); renderTotals(); renderStats(); updateCharts(); }

/* ---------------------- Utilities ---------------------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* ---------------------- Downloads: Monthly PDF ---------------------- */
async function downloadMonthlyPDF(){
  // Build a snapshot element: clone report-area with table and charts
  const container = document.createElement('div');
  container.style.padding = '18px';
  container.style.background = '#fff';
  container.style.width = '1000px';
  container.style.boxSizing = 'border-box';
  container.innerHTML = `
    <h2>Monthly Expense Report — ${currentMonthKey()}</h2>
    <p>User: ${escapeHtml(currentUser.firstName + ' ' + currentUser.lastName)} — ${escapeHtml(currentUser.email)}</p>
    <p>Starting Balance: ৳ ${parseFloat(localStorage.getItem(sbKey(currentUser.email,currentMonthKey()))||0).toFixed(2)}</p>
    <p>Budget: ৳ ${parseFloat(localStorage.getItem(budgetKey(currentUser.email,currentMonthKey()))||0).toFixed(2)}</p>
    <div id="pdf-charts" style="display:flex; gap:10px; margin-top:10px;"></div>
    <h3>Expenses (this month)</h3>
    <table id="pdf-table" style="width:100%; border-collapse:collapse;">
      <thead><tr><th style="border:1px solid #ccc;padding:6px">Name</th><th style="border:1px solid #ccc;padding:6px">Amount</th><th style="border:1px solid #ccc;padding:6px">Category</th><th style="border:1px solid #ccc;padding:6px">Date</th></tr></thead>
      <tbody id="pdf-tbody"></tbody>
    </table>
  `;

  // fill pdf-table with month's expense rows
  const month = currentMonthKey();
  const rows = expenses.filter(e => monthKey(e.date) === month).sort((a,b)=> a.date<b.date?1:-1);
  const pdfTbody = container.querySelector('#pdf-tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="border:1px solid #ddd;padding:6px">${escapeHtml(r.name)}</td>
                    <td style="border:1px solid #ddd;padding:6px">৳ ${Number(r.amount).toFixed(2)}</td>
                    <td style="border:1px solid #ddd;padding:6px">${escapeHtml(r.category)}</td>
                    <td style="border:1px solid #ddd;padding:6px">${escapeHtml(r.date)}</td>`;
    pdfTbody.appendChild(tr);
  });

  // Create canvas snapshots for charts (re-draw charts into small canvases)
  // Create two canvases and draw the same chart data
  const chartArea = container.querySelector('#pdf-charts');

  const canvas1 = document.createElement('canvas'); canvas1.width = 480; canvas1.height = 240;
  const canvas2 = document.createElement('canvas'); canvas2.width = 480; canvas2.height = 240;
  chartArea.appendChild(canvas1); chartArea.appendChild(canvas2);

  // Draw category pie on canvas1
  const catTotals = {}; const weekTotals = [0,0,0,0,0,0,0];
  expenses.forEach(e=>{
    if(monthKey(e.date) === currentMonthKey()){
      catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount||0);
      weekTotals[new Date(e.date).getDay()] += Number(e.amount||0);
    }
  });
  // Chart.js allows drawing to a canvas element
  const catLabels = Object.keys(catTotals); const catData = Object.values(catTotals);
  // create temporary charts
  const tmpCat = new Chart(canvas1, { type:'pie', data:{ labels:catLabels, datasets:[{ data:catData, backgroundColor:['#ff6384','#36a2eb','#ffcd56','#4bc0c0','#7c4dff'] }] } });
  const tmpWeek = new Chart(canvas2, { type:'bar', data:{ labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets:[{ label:'Weekly', data:weekTotals, backgroundColor:'#2563eb' }] }, options:{ scales:{ y:{ beginAtZero:true } } } });

  // Wait a tick for charts to render
  await new Promise(r=>setTimeout(r,300));

  // Use html2canvas to render container to image
  const canvas = await html2canvas(container, { scale: 2, useCORS:true, logging:false });
  // cleanup temporary charts
  tmpCat.destroy(); tmpWeek.destroy();

  // Create PDF
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  // Calculate dimensions to fit A4 (595 x 842 pts)
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 40;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let posY = 20;
  pdf.addImage(imgData, 'JPEG', 20, posY, imgWidth, imgHeight);
  const filename = `ExpenseReport_${currentUser.email}_${currentMonthKey()}.pdf`;
  pdf.save(filename);
}

/* ---------------------- Render helpers ---------------------- */
function renderTable(){
  const tbody = $('#expense-table-body'); tbody.innerHTML='';
  const rows = [...expenses].sort((a,b)=> a.date===b.date ? b.id-a.id : (a.date < b.date ? 1 : -1));
  rows.forEach(exp=>{
    const tr = document.createElement('tr'); tr.classList.add('added');
    tr.innerHTML = `<td>${escapeHtml(exp.name)}</td>
                    <td>৳ ${Number(exp.amount).toFixed(2)}</td>
                    <td>${escapeHtml(exp.category)}</td>
                    <td>${escapeHtml(exp.date)}</td>
                    <td><button class="btn-light" onclick="deleteExpense(${exp.id}, this)">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderTotals(){
  const grand = expenses.reduce((s,e)=> s + Number(e.amount||0), 0);
  $('#total-amount').textContent = grand.toFixed(2);
}

function renderStats(){
  const yymm = currentMonthKey();
  const sb = parseFloat(localStorage.getItem(sbKey(currentUser.email,yymm))||'0');
  const monthTotal = expenses.filter(e=> monthKey(e.date)===yymm ).reduce((s,e)=> s + Number(e.amount||0), 0);
  const remaining = sb - monthTotal;
  $('#stat-starting-balance').textContent = sb.toFixed(2);
  $('#stat-total-month').textContent = monthTotal.toFixed(2);
  $('#stat-remaining').textContent = remaining.toFixed(2);
  // budget alert
  const budget = parseFloat(localStorage.getItem(budgetKey(currentUser.email,yymm))||'0');
  if(budget>0 && monthTotal >= budget) $('#budget-alert').hidden = false; else $('#budget-alert').hidden = true;
}

function updateCharts(){
  const catTotals = {}; const weekTotals = [0,0,0,0,0,0,0];
  expenses.forEach(e=>{
    catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount||0);
    const d = new Date(e.date).getDay(); weekTotals[d] += Number(e.amount||0);
  });
  const catLabels = Object.keys(catTotals); const catData = Object.values(catTotals);
  if(categoryChart) categoryChart.destroy();
  categoryChart = new Chart($('#categoryChart'), { type:'pie', data:{ labels:catLabels, datasets:[{ data:catData, backgroundColor:['#ff6384','#36a2eb','#ffcd56','#4bc0c0','#7c4dff'] }] } });
  if(weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart($('#weeklyChart'), { type:'bar', data:{ labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets:[{ label:'Weekly', data:weekTotals, backgroundColor:'#2563eb' }] }, options:{ scales:{ y:{ beginAtZero:true } } } });
}

function renderAll(){ renderTable(); renderTotals(); renderStats(); updateCharts(); }

/* ---------------------- Utility functions ---------------------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* ---------------------- Save/load expenses ---------------------- */
function saveExpenses(){ localStorage.setItem(expKey(currentUser.email), JSON.stringify(expenses)); }
function loadExpenses(){ expenses = JSON.parse(localStorage.getItem(expKey(currentUser.email)) || '[]'); }

/* ---------------------- On login actions ---------------------- */
function onLogin(){
  showPage('dashboard');
  users = loadUsers();
  currentUser = users.find(u=>u.email===currentUserEmail);
  if(!currentUser){ setCurrentUserEmail(null); showPage('home'); return; }
  loadExpenses();
  renderProfile();
  ensureStartingBalance();
  ensureTodayEntry();
  renderAll();
  if($('#expense-date')) $('#expense-date').value = todayISO();
}

/* ---------------------- Delete function (global) ---------------------- */
window.deleteExpense = function(id, btn){
  const tr = btn.closest('tr'); tr.classList.add('removed');
  tr.addEventListener('animationend', ()=>{
    const idx = expenses.findIndex(x=>x.id===id); if(idx>-1) expenses.splice(idx,1);
    saveExpenses(); renderAll();
  }, { once:true });
};

/* ---------------------- Download PDF button ---------------------- */
$('#download-month-pdf').addEventListener('click', async ()=>{
  if(!currentUser){ alert('Login first'); return; }
  await downloadMonthlyPDF();
});

/* ---------------------- Logout & Back buttons ---------------------- */
$('#logout-btn').addEventListener('click', ()=>{
  setCurrentUserEmail(null); currentUser=null; expenses=[]; showPage('home');
});

/* ---------------------- Initialization: restore session if any ---------------------- */
currentUserEmail = getCurrentUserEmail();
if(currentUserEmail){
  users = loadUsers();
  currentUser = users.find(u=>u.email===currentUserEmail);
  if(currentUser) onLogin(); else { setCurrentUserEmail(null); showPage('home'); }
} else showPage('home');

/* ---------------------- Expense form submission (must be after onLogin available) ---------------------- */
$('#expense-form').addEventListener('submit', e=>{
  e.preventDefault();
  if(!currentUser){ alert('Login required'); return; }
  const name = $('#expense-name').value.trim(); const amount = parseFloat($('#expense-amount').value || '0');
  const category = $('#expense-category').value; const date = $('#expense-date').value || todayISO();
  if(!name){ alert('Please enter name'); return; }
  if(isNaN(amount)){ alert('Please enter valid amount'); return; }
  const item = { id: Date.now()+Math.floor(Math.random()*1000), name, amount: isNaN(amount)?0:amount, category, date, auto:false };
  expenses.push(item); saveExpenses(); renderAll(); e.target.reset(); if(date===todayISO()) $('#reminder-banner').hidden=true;
});

/* ---------------------- ensureTodayEntry used earlier - duplicate kept for safety ---------------------- */
function ensureTodayEntry(){
  if(!currentUser) return;
  const today = todayISO();
  const has = expenses.some(e=> e.date===today);
  if(!has){
    expenses.push({ id: Date.now()+Math.floor(Math.random()*1000), name:'No Expense', amount:0, category:'None', date:today, auto:true });
    saveExpenses();
    $('#reminder-banner').hidden = false;
  } else $('#reminder-banner').hidden = true;
}

/* ---------------------- End of file ---------------------- */

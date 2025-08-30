// ===== Page Navigation =====
const pages = document.querySelectorAll('.page');
function showPage(selector) {
  pages.forEach(p => p.classList.remove('active'));
  document.querySelector(selector).classList.add('active');
}

// Navigation buttons
document.getElementById('show-login').addEventListener('click', () => showPage('.login'));
document.getElementById('show-signup').addEventListener('click', () => showPage('.signup'));
document.querySelectorAll('.back-home').forEach(btn => {
  btn.addEventListener('click', () => showPage('.home'));
});

// ===== Users =====
let users = JSON.parse(localStorage.getItem('users')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// ===== Signup =====
document.getElementById('signup-form').addEventListener('submit', e => {
  e.preventDefault();
  const firstName = document.getElementById('first-name').value;
  const lastName = document.getElementById('last-name').value;
  const email = document.getElementById('signup-email').value;
  const phone = document.getElementById('phone').value;
  const gender = document.getElementById('gender').value;
  const password = document.getElementById('signup-password').value;

  if (users.find(u => u.email === email)) {
    alert('User already exists!');
    return;
  }

  users.push({ firstName, lastName, email, phone, gender, password });
  localStorage.setItem('users', JSON.stringify(users));
  alert('Signup successful! Please login.');
  showPage('.login');
  e.target.reset();
});

// ===== Login =====
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    alert('Invalid email or password!');
    return;
  }

  currentUser = user;
  localStorage.setItem('currentUser', JSON.stringify(user));
  showPage('.dashboard');
  showUserProfile();
  loadUserExpenses();
  e.target.reset();
});

// ===== Show Profile =====
function showUserProfile() {
  if (!currentUser) return;
  document.getElementById('profile-name').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-phone').textContent = currentUser.phone;
}

// ===== Dashboard Expenses =====
const expenseForm = document.getElementById('expense-form');
const expenseTableBody = document.getElementById('expense-table-body');
const totalAmountEl = document.getElementById('total-amount');
const logoutBtn = document.getElementById('logout-btn');

let expenses = [];

function loadUserExpenses() {
  expenses = JSON.parse(localStorage.getItem(`expenses_${currentUser.email}`)) || [];
  renderExpenses();
}

function saveExpenses() {
  localStorage.setItem(`expenses_${currentUser.email}`, JSON.stringify(expenses));
}

function renderExpenses() {
  expenseTableBody.innerHTML = '';
  let total = 0;
  expenses.forEach((exp, i) => {
    total += parseFloat(exp.amount);
    const row = document.createElement('tr');
    row.classList.add('added');
    row.innerHTML = `
      <td>${exp.name}</td>
      <td>$${exp.amount}</td>
      <td>${exp.category}</td>
      <td>${exp.date}</td>
      <td><button onclick="deleteExpense(${i}, this)">Delete</button></td>
    `;
    expenseTableBody.appendChild(row);
  });
  totalAmountEl.textContent = total.toFixed(2);
}

function deleteExpense(index, btn) {
  const row = btn.parentElement.parentElement;
  row.classList.add('removed');
  row.addEventListener('animationend', () => {
    expenses.splice(index, 1);
    saveExpenses();
    renderExpenses();
  });
}

expenseForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('expense-name').value;
  const amount = document.getElementById('expense-amount').value;
  const category = document.getElementById('expense-category').value;
  const date = document.getElementById('expense-date').value;

  expenses.push({ name, amount, category, date });
  saveExpenses();
  renderExpenses();
  e.target.reset();
});

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  currentUser = null;
  showPage('.home');
});

// Auto-login if user exists
if (currentUser) {
  showPage('.dashboard');
  showUserProfile();
  loadUserExpenses();
}

// Make deleteExpense global
window.deleteExpense = deleteExpense;

function showSection(id) {
  document.querySelectorAll('.container').forEach(div => div.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function signUp() {
  let user = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('signupEmail').value,
    phone: document.getElementById('signupPhone').value,
    gender: document.getElementById('signupGender').value,
    password: document.getElementById('signupPassword').value,
    balance: parseFloat(document.getElementById('signupBalance').value),
    expenses: []
  };
  if (!user.email || !user.password || isNaN(user.balance)) {
    alert("Please fill all fields");
    return;
  }
  localStorage.setItem(user.email, JSON.stringify(user));
  alert("Signup successful! Please login.");
  showSection('login');
}

function login() {
  let email = document.getElementById('loginEmail').value;
  let password = document.getElementById('loginPassword').value;
  let user = JSON.parse(localStorage.getItem(email));
  if (user && user.password === password) {
    localStorage.setItem('loggedInUser', email);
    loadDashboard(user);
    showSection('dashboard');
  } else {
    alert("Invalid credentials");
  }
}

function resetPassword() {
  let email = document.getElementById('resetEmail').value;
  let newPassword = document.getElementById('newPassword').value;
  let user = JSON.parse(localStorage.getItem(email));
  if (user) {
    user.password = newPassword;
    localStorage.setItem(email, JSON.stringify(user));
    alert("Password reset successful! Please login.");
    showSection('login');
  } else {
    alert("Email not found!");
  }
}

function logout() {
  localStorage.removeItem('loggedInUser');
  showSection('home');
}

function loadDashboard(user) {
  document.getElementById('welcomeText').innerText = `Welcome, ${user.firstName}`;
  updateSummary(user);
  loadExpenses(user);
  checkDailyReminder(user);
}

function updateSummary(user) {
  let totalExpense = user.expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('totalBalance').innerText = user.balance.toFixed(2);
  document.getElementById('monthlyExpense').innerText = totalExpense.toFixed(2);
  document.getElementById('remainingBalance').innerText = (user.balance - totalExpense).toFixed(2);
}

function loadExpenses(user) {
  let table = document.getElementById('expenseTable');
  table.innerHTML = '';
  user.expenses.forEach((e, index) => {
    let row = `<tr>
      <td>${e.title}</td>
      <td>$${e.amount}</td>
      <td>${e.date}</td>
      <td><button onclick="deleteExpense(${index})">Delete</button></td>
    </tr>`;
    table.innerHTML += row;
  });
}

function addExpense() {
  let email = localStorage.getItem('loggedInUser');
  let user = JSON.parse(localStorage.getItem(email));
  let title = document.getElementById('expenseTitle').value;
  let amount = parseFloat(document.getElementById('expenseAmount').value);
  if (!title || isNaN(amount)) {
    alert("Enter valid expense details");
    return;
  }
  let expense = { title, amount, date: new Date().toLocaleDateString() };
  user.expenses.push(expense);
  localStorage.setItem(email, JSON.stringify(user));
  loadDashboard(user);
  document.getElementById('expenseTitle').value = '';
  document.getElementById('expenseAmount').value = '';
}

function deleteExpense(index) {
  let email = localStorage.getItem('loggedInUser');
  let user = JSON.parse(localStorage.getItem(email));
  user.expenses.splice(index, 1);
  localStorage.setItem(email, JSON.stringify(user));
  loadDashboard(user);
}

function checkDailyReminder(user) {
  let today = new Date().toLocaleDateString();
  let hasExpenseToday = user.expenses.some(e => e.date === today);
  document.getElementById('dailyReminder').innerText = hasExpenseToday ? '' : 'Reminder: Add today’s expense!';
}

// Auto-login if session exists
let loggedInUser = localStorage.getItem('loggedInUser');
if (loggedInUser) {
  let user = JSON.parse(localStorage.getItem(loggedInUser));
  loadDashboard(user);
  showSection('dashboard');
} else {
  showSection('home');
}

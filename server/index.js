const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('./authMiddleware');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

const cors = require('cors');

app.use(express.json());
app.use(cors());

// Authorization: being logged in isn't enough — the user must also belong to
// the group whose data they're trying to read or change.
async function isGroupMember(userId, groupId) {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  return membership !== null;
}

// For routes with :groupId in the URL
async function requireGroupMember(req, res, next) {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group id' });
  }

  if (!(await isGroupMember(req.userId, groupId))) {
    return res.status(403).json({ error: 'You are not a member of this group' });
  }

  next();
}

// For routes with an expense :id in the URL — look up which group the
// expense belongs to, then check membership in that group
async function requireExpenseAccess(req, res, next) {
  const expenseId = parseInt(req.params.id);
  if (isNaN(expenseId)) {
    return res.status(400).json({ error: 'Invalid expense id' });
  }

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  if (!(await isGroupMember(req.userId, expense.groupId))) {
    return res.status(403).json({ error: 'You are not a member of this group' });
  }

  req.expense = expense;
  next();
}

// Input validation: the frontend checks forms too, but anyone can call the
// API directly, so the server can't trust what it receives.
const CATEGORIES = ['Groceries', 'Rent', 'Utilities', 'Trip', 'Other'];
const STATUSES = ['paid', 'pending'];
const MAX_AMOUNT = 1000000;

function isNonEmptyString(value, maxLength = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isValidAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!isNonEmptyString(email) || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!isNonEmptyString(name, 100)) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, name: name.trim() },
    });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Create a group (creator is automatically added as a member)
app.post('/api/groups', authMiddleware, async (req, res) => {
  const { name } = req.body;

  if (!isNonEmptyString(name, 100)) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      members: {
        create: [{ userId: req.userId }],
      },
    },
    include: { members: true },
  });

  res.json(group);
});

// List groups the logged-in user belongs to
app.get('/api/groups', authMiddleware, async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId },
    include: { group: true },
  });

  const groups = memberships.map(m => m.group);
  res.json(groups);
});

// Add a member to a group (by email)
app.post('/api/groups/:groupId/members', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { email } = req.body;

  if (!isNonEmptyString(email)) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const userToAdd = await prisma.user.findUnique({ where: { email } });
  if (!userToAdd) {
    return res.status(404).json({ error: 'No user with that email' });
  }

  if (await isGroupMember(userToAdd.id, groupId)) {
    return res.status(409).json({ error: 'That user is already in this group' });
  }

  const membership = await prisma.groupMember.create({
    data: {
      userId: userToAdd.id,
      groupId: groupId,
    },
  });

  res.json(membership);
});

// Get members of a group, with their names
app.get('/api/groups/:groupId/members', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);

  const members = await prisma.groupMember.findMany({
    where: { groupId: groupId },
    include: { user: true },
  });

  const result = members.map(m => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  res.json(result);
});

// Log an expense, split evenly among all group members
app.post('/api/groups/:groupId/expenses', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { amount, description, category, date, status } = req.body;

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: `Amount must be a number greater than 0 and at most ${MAX_AMOUNT}` });
  }
  if (!isNonEmptyString(description)) {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be paid or pending' });
  }
  if (typeof date !== 'string' || isNaN(new Date(date).getTime())) {
    return res.status(400).json({ error: 'A valid date is required' });
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId: groupId },
  });

  const splitAmount = amount / members.length;

  const expense = await prisma.expense.create({
    data: {
      groupId: groupId,
      paidById: req.userId,
      amount: amount,
      description: description.trim(),
      category: category || 'Other',
      status: status || 'paid',
      date: new Date(date),
      splits: {
        create: members.map(member => ({
          userId: member.userId,
          amount: splitAmount,
        })),
      },
    },
    include: { splits: true },
  });

  res.json(expense);
});

// List expenses for a group
app.get('/api/groups/:groupId/expenses', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId },
    include: { paidBy: true },
    orderBy: { date: 'desc' },
  });

  const result = expenses.map(e => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    status: e.status,
    date: e.date,
    paidByName: e.paidBy.name,
  }));

  res.json(result);
});

// Mark a pending expense as paid
app.patch('/api/expenses/:id/pay', authMiddleware, requireExpenseAccess, async (req, res) => {
  const expenseId = req.expense.id;

  if (req.expense.status === 'paid') {
    return res.status(409).json({ error: 'This expense has already been paid' });
  }

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'paid', paidById: req.userId },
  });

  res.json(expense);
});

// Delete an expense
app.delete('/api/expenses/:id', authMiddleware, requireExpenseAccess, async (req, res) => {
  try {
    const expenseId = req.expense.id;

    await prisma.expenseSplit.deleteMany({
      where: { expenseId: expenseId },
    });

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.get('/api/groups/:groupId/balances', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId, status: 'paid' },
    include: { splits: true },
  });

  const balances = {};

  for (const expense of expenses) {
    balances[expense.paidById] = (balances[expense.paidById] || 0) + expense.amount;

    for (const split of expense.splits) {
      balances[split.userId] = (balances[split.userId] || 0) - split.amount;
    }
  }

  res.json(balances);
});

app.get('/api/groups/:groupId/settle', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId, status: 'paid' },
    include: { splits: true },
  });

  const balances = {};
  for (const expense of expenses) {
    balances[expense.paidById] = (balances[expense.paidById] || 0) + expense.amount;
    for (const split of expense.splits) {
      balances[split.userId] = (balances[split.userId] || 0) - split.amount;
    }
  }

  const debtors = [];
  const creditors = [];

  for (const userId in balances) {
    const amount = Math.round(balances[userId] * 100) / 100;
    if (amount < 0) debtors.push({ userId: parseInt(userId), amount: -amount });
    if (amount > 0) creditors.push({ userId: parseInt(userId), amount: amount });
  }

  const transactions = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: Math.round(settledAmount * 100) / 100,
    });

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) debtors.shift();
    if (creditor.amount < 0.01) creditors.shift();
  }

  res.json(transactions);
});

// Get spending totals by category for a group
app.get('/api/groups/:groupId/spending-by-category', authMiddleware, requireGroupMember, async (req, res) => {
  const groupId = parseInt(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId, status: 'paid' },
  });

  const totals = {};
  for (const expense of expenses) {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  }

  const result = Object.entries(totals).map(([category, total]) => ({
    category,
    total: Math.round(total * 100) / 100,
  }));

  res.json(result);
});

// Log a new drink
app.post('/api/groups/:groupId/drinks', authMiddleware, requireGroupMember, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { name, cost, rating, imageUrl } = req.body;

    if (!isNonEmptyString(name, 100)) {
      return res.status(400).json({ error: 'Drink name is required' });
    }
    if (!isValidAmount(cost)) {
      return res.status(400).json({ error: 'Cost must be a number greater than 0' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5' });
    }
    if (imageUrl && (typeof imageUrl !== 'string' || !/^https?:\/\//.test(imageUrl))) {
      return res.status(400).json({ error: 'Image URL must start with http:// or https://' });
    }

    const drink = await prisma.drink.create({
      data: {
        groupId: groupId,
        loggedById: req.userId,
        name: name.trim(),
        cost: cost,
        rating: rating,
        imageUrl: imageUrl || null,
      },
      include: { loggedBy: true },
    });

    res.json({
      id: drink.id,
      name: drink.name,
      cost: drink.cost,
      rating: drink.rating,
      imageUrl: drink.imageUrl,
      date: drink.date,
      loggedByName: drink.loggedBy.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// List all drinks for a group, plus the running total
app.get('/api/groups/:groupId/drinks', authMiddleware, requireGroupMember, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);

    const drinks = await prisma.drink.findMany({
      where: { groupId: groupId },
      include: { loggedBy: true },
      orderBy: { date: 'desc' },
    });

    const result = drinks.map(d => ({
      id: d.id,
      name: d.name,
      cost: d.cost,
      rating: d.rating,
      imageUrl: d.imageUrl,
      date: d.date,
      loggedByName: d.loggedBy.name,
    }));

    const total = drinks.reduce((sum, d) => sum + d.cost, 0);

    res.json({ drinks: result, total: Math.round(total * 100) / 100 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Parse natural language into a structured expense using AI
app.post('/api/groups/:groupId/parse-expense', authMiddleware, requireGroupMember, async (req, res) => {
  try {
    const { text } = req.body;

    if (!isNonEmptyString(text, 500)) {
      return res.status(400).json({ error: 'Please enter a description of the expense (up to 500 characters)' });
    }

    const prompt = `Extract expense details from this sentence and return ONLY valid JSON, no other text, no markdown formatting. The JSON should have these fields: description (string, short), amount (number), category (one of: Groceries, Rent, Utilities, Trip, Other), date (string in YYYY-MM-DD format, use today's date ${new Date().toISOString().split('T')[0]} if not mentioned).

Sentence: "${text}"`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content;
    const cleanedText = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    // The model can return something that's valid JSON but not a usable expense
    if (!isValidAmount(parsed.amount) || !isNonEmptyString(parsed.description)) {
      throw new Error('AI response missing amount or description');
    }
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'Other';
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not parse expense. Try rephrasing.' });
  }
});

// Catch-all error handler so the client always gets JSON back, never an HTML
// error page or a stack trace
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

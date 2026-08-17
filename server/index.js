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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

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

  const group = await prisma.group.create({
    data: {
      name: name,
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
app.post('/api/groups/:groupId/members', authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { email } = req.body;

  const userToAdd = await prisma.user.findUnique({ where: { email } });
  if (!userToAdd) {
    return res.status(404).json({ error: 'No user with that email' });
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
app.get('/api/groups/:groupId/members', authMiddleware, async (req, res) => {
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
app.post('/api/groups/:groupId/expenses', authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { amount, description, category, date, status } = req.body;

  const members = await prisma.groupMember.findMany({
    where: { groupId: groupId },
  });

  const splitAmount = amount / members.length;

  const expense = await prisma.expense.create({
    data: {
      groupId: groupId,
      paidById: req.userId,
      amount: amount,
      description: description,
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
app.get('/api/groups/:groupId/expenses', authMiddleware, async (req, res) => {
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
app.patch('/api/expenses/:id/pay', authMiddleware, async (req, res) => {
  const expenseId = parseInt(req.params.id);

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'paid', paidById: req.userId },
  });

  res.json(expense);
});

// Delete an expense
app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await prisma.expenseSplit.deleteMany({
      where: { expenseId: expenseId },
    });

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/groups/:groupId/balances', authMiddleware, async (req, res) => {
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

app.get('/api/groups/:groupId/settle', authMiddleware, async (req, res) => {
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
app.get('/api/groups/:groupId/spending-by-category', authMiddleware, async (req, res) => {
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
app.post('/api/groups/:groupId/drinks', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { name, cost, rating, imageUrl } = req.body;

    const drink = await prisma.drink.create({
      data: {
        groupId: groupId,
        loggedById: req.userId,
        name: name,
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
    res.status(400).json({ error: err.message });
  }
});

// List all drinks for a group, plus the running total
app.get('/api/groups/:groupId/drinks', authMiddleware, async (req, res) => {
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
    res.status(400).json({ error: err.message });
  }
});

// Parse natural language into a structured expense using AI
app.post('/api/groups/:groupId/parse-expense', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

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

    const data = await response.json();
    console.log('Groq response:', JSON.stringify(data));
    const rawText = data.choices[0].message.content;
    const cleanedText = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not parse expense. Try rephrasing.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

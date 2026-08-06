# EvenUp

A full-stack expense-splitting app for roommates and trips. Log shared expenses, track upcoming bills, see who owes who, and get the minimum number of payments needed to settle up — plus a fun side feature for logging and rating drinks with the group.

## Features

**Core expense splitting**
- Signup/login with hashed passwords (bcrypt) and JWT-based sessions
- Create groups (an apartment, a trip, etc.) and add members by email
- Log shared expenses with category, description, and date — costs split evenly among group members
- Mark expenses as **pending** (a bill that's due but nobody's paid yet) vs. **paid** — pending bills don't affect balances until someone actually covers them and marks them paid
- Edit and delete expenses
- See each group member's real name and current balance (owed / owes / settled up)
- **Settle-up algorithm** — a greedy debt-simplification algorithm that reduces a group's debts to the minimum number of transactions needed to fully settle up, instead of a messy web of small payments between every pair of people
- Spending-by-category breakdown, visualized as a pie chart

**Drink Log**
- A separate per-group log for tracking fun drinks (coffee runs, matcha, boba, etc.)
- Rate each drink 1–5 stars and optionally attach a photo (via image URL)
- Running total of group drink spending
- A scrollable photo gallery of rated drinks

## Tech Stack

**Languages:** JavaScript, HTML, CSS, SQL
**Backend:** Node.js, Express, PostgreSQL, Prisma ORM, JWT, bcrypt
**Frontend:** React (Vite), Recharts

## How the Settle-Up Algorithm Works

1. Calculate each person's net balance across all *paid* expenses in a group (total they paid minus their fair share of everything)
2. Split people into two groups: those who owe money (debtors) and those who are owed money (creditors)
3. Repeatedly match the person who owes the most with the person who's owed the most, and settle the smaller of the two amounts between them
4. Repeat until everyone's balance reaches zero

This greedy approach minimizes the total number of transactions needed to fully settle a group, rather than naively pairing up every individual expense.

## Running Locally

### Backend
```bash
cd server
npm install
# Create a .env file with:
# DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/expense_splitter?schema=public"
# JWT_SECRET="your-secret-key"
npx prisma migrate dev
node index.js
```

### Frontend
```bash
cd client
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and expects the backend on `http://localhost:3000`.

## Data Model

- **User** — email, name, hashed password
- **Group** — a shared space (apartment, trip) with members
- **GroupMember** — join table linking users to groups
- **Expense** — an expense in a group: amount, category, status (paid/pending), who paid, and its equal splits across members
- **ExpenseSplit** — how much each member owes for a given expense
- **Drink** — a logged drink in a group: name, cost, rating, optional image, who logged it

## Roadmap

- Custom (uneven) expense splits, not just equal shares
- Real-time updates across group members (WebSockets)
- Deployment

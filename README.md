# EvenUp

A full-stack expense-splitting app for roommates, trips, and shared living costs. Log shared expenses, see who owes who, and get the minimum number of payments needed to settle up.

## Features

- **Authentication** — signup/login with hashed passwords (bcrypt) and JWT-based sessions
- **Groups** — create a group (apartment, trip, etc.) and add members by email
- **Expense tracking** — log shared expenses with category, description, and date; costs split evenly among group members
- **Balance calculation** — see exactly who owes money and who's owed money in a group
- **Settle-up algorithm** — a greedy debt-simplification algorithm that reduces a group's debts down to the minimum number of transactions needed to settle everyone up, instead of a messy web of small payments between every pair of people

## Tech Stack

**Backend:** Node.js, Express, PostgreSQL, Prisma ORM, JWT, bcrypt
**Frontend:** React (Vite)

## How the Settle-Up Algorithm Works

1. Calculate each person's net balance across all expenses in a group (total they paid minus their fair share of everything)
2. Split people into two groups: those who owe money (debtors) and those who are owed money (creditors)
3. Repeatedly match the person who owes the most with the person who's owed the most, and settle the smaller of the two amounts between them
4. Repeat until everyone's balance reaches zero

This greedy approach minimizes the total number of transactions needed to fully settle a group, rather than naively pairing up every individual expense.

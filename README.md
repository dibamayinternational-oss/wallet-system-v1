# MayPay — Wallet & Ledger System

A secure, backend-driven digital wallet system built with FastAPI, PostgreSQL, and React. MayPay supports wallet deposits, withdrawals, and transfers while maintaining a permanent double-entry ledger to ensure financial transaction integrity.

## Overview

MayPay is a digital wallet application designed around reliable financial transaction processing. It combines a user-facing wallet interface with administrative controls and a ledger-based accounting system.

Unlike a simple balance-tracking application, MayPay records financial movements through double-entry accounting, maintains transaction history, and supports administrative monitoring and reconciliation.

## Features

### User Features
- **Authentication & Authorization** — Secure registration, login, and role-based access.
- **Digital Wallet** — Individual wallets with unique wallet numbers and balance tracking.
- **Cash In** — Deposit funds into a wallet.
- **Cash Out** — Submit withdrawal requests with approval handling for high-value withdrawals.
- **Send Money** — Transfer funds between wallets with configurable transaction fees.
- **Transaction History** — View deposits, withdrawals, transfers, and transaction details.
- **PDF Statements** — Download wallet statements for selected date ranges.
- **Transaction Notes** — Attach notes to transactions for better tracking.
- **Limits & Fees** — View applicable transaction limits and fee information.

### Administrative Features
- **Admin Dashboard** — Monitor wallet activity, transaction volumes, and financial metrics.
- **User & Wallet Management** — View users, wallet information, and balances.
- **Wallet Controls** — Freeze and unfreeze wallets.
- **Transaction Monitoring** — Search, filter, and inspect financial transactions.
- **Transaction Reversal** — Reverse eligible transfers while preserving transaction history.
- **Audit Logs** — Track administrative actions and important system events.
- **Financial Reports** — Generate daily summaries, trial balances, and reconciliation reports.
- **PDF Report Downloads** — Export financial reports for review and recordkeeping.

### Financial Integrity
- **Double-Entry Ledger** — Every posted financial transaction is represented through balanced debit and credit entries.
- **Immutable Ledger Records** — Posted ledger entries are protected against modification.
- **Balance Protection** — Database constraints help prevent invalid wallet balances.
- **Transaction Validation** — Validate wallet status, transaction amounts, and transfer conditions.
- **Idempotency** — Protect transfer processing against duplicate requests.
- **Reserved Balances** — Support withdrawal request processing without treating reserved funds as freely available.
- **Reconciliation** — Compare financial records and identify inconsistencies.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database Migrations | Alembic |
| Authentication | JWT |
| API Testing | Postman |
| Version Control | Git, GitHub |

## Architecture

MayPay follows a client-server architecture.

```text
             React Frontend
                   |
                   | REST API
                   | JSON / HTTP
                   v
             FastAPI Backend
                   |
          +--------+--------+
          |        |        |
      Auth     Wallet   Ledger &
      Layer    Services  Transaction
          |        |        |
          +--------+--------+
                   |
                   v
              PostgreSQL
```

The frontend communicates with the backend through REST API endpoints. The backend handles authentication, validation, business logic, and financial transaction processing. PostgreSQL stores wallet data, transaction records, ledger entries, and audit information.

## Project Structure

```text
wallet-system-v1/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── endpoints/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── alembic/
│   ├── scripts/
│   ├── tests/
│   ├── requirements.txt
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/wallet-system-v1.git
cd wallet-system-v1
```

### 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

**Windows PowerShell**
```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/wallet_system_v1
JWT_SECRET_KEY=your_secure_random_secret
```

Replace the database credentials and secret with your own values.

### 4. Create the Database

Create a PostgreSQL database named:

```text
wallet_system_v1
```

### 5. Apply Database Migrations

From the backend directory:

```bash
alembic upgrade head
```

### 6. Start the Backend

```bash
python -m uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

### 7. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will display the local frontend URL in the terminal.

## API Documentation

MayPay provides REST API endpoints for authentication, wallet operations, transactions, and administrative functionality.

Interactive API documentation is available through FastAPI's Swagger UI:

`http://localhost:8000/docs`

The API uses JSON request and response bodies and JWT-based authentication for protected endpoints.

## Testing

Backend tests are located in:

```text
backend/tests/
```

Run the test suite from the backend directory:

```bash
pytest
```

API behavior can also be tested using Postman.

## Security Considerations

- Passwords are stored using password hashing rather than plaintext.
- Protected endpoints use JWT authentication.
- Role-based authorization separates user and administrative operations.
- Database constraints protect financial data integrity.
- Posted ledger records are protected against modification.
- Transaction validation helps prevent invalid financial operations.
- Sensitive environment variables are kept outside source code.

## Project Purpose

MayPay was developed to explore the design and implementation of a reliable digital wallet system, with particular emphasis on:

- Backend engineering and REST API development
- Financial transaction processing
- Double-entry accounting
- Database integrity and transaction management
- Authentication and authorization
- Administrative monitoring and reporting
- Full-stack application development

---

**MayPay — A digital wallet system built around financial integrity.**

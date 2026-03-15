# Trading Platform - Backtest Trading Strategies

A full-stack trading platform for backtesting trading strategies with role-based access control, real-time updates, and interactive visualizations.

## 🚀 Features

### Backend (NestJS + Prisma)
- **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Admin/Researcher)
  - Password hashing with bcrypt

- **Database (PostgreSQL)**
  - Organizations management
  - User management with roles
  - Strategy storage with file uploads
  - Backtest results with JSONB data

- **File Management**
  - Python file upload for strategies
  - Secure file storage
  - File validation

- **Real-time Updates**
  - Socket.io integration for backtest progress
  - Live progress tracking

### Frontend (Next.js 15 + Shadcn/UI)
- **Modern UI Components**
  - Responsive dashboard layout
  - Strategy cards with status indicators
  - Upload forms with drag-and-drop
  - Progress bars for backtesting

- **Data Visualization**
  - TradingView Lightweight Charts for PnL
  - Performance metrics cards
  - Backtest logs display

- **State Management**
  - TanStack Query for server state
  - Real-time socket updates
  - Optimistic updates

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## 🛠️ Tech Stack

### Backend
- NestJS - Node.js framework
- Prisma - ORM
- PostgreSQL - Database
- Passport JWT - Authentication
- Socket.io - Real-time updates
- Multer - File upload

### Frontend
- Next.js 15 - React framework
- Shadcn/UI - Component library
- TanStack Query - State management
- Lightweight Charts - Trading charts
- Socket.io-client - Real-time updates
- React Dropzone - File upload

## 🚀 Installation

### 1. Clone the repository
```bash
git clone https://github.com/huuloc2026/trading-platform
cd trading-platform
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your database credentials
# DATABASE_URL="postgresql://user:password@localhost:5432/trading_db"
# JWT_SECRET="your-super-secret-jwt-key"

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Start development server
npm run start:dev
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your API URL
# NEXT_PUBLIC_API_URL=http://localhost:3000
# NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Start development server
npm run dev
```

## 📁 Project Structure

```
trading-platform/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   ├── strategies/
│   │   │   └── interfaces/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   └── decorators/
│   │   ├── prisma/
│   │   ├── strategies/
│   │   ├── users/
│   │   └── organizations/
│   ├── prisma/
│   │   └── schema.prisma
│   └── uploads/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   └── providers.tsx
│   │   ├── components/
│   │   │   ├── strategies/
│   │   │   ├── backtest/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── providers/
│   └── public/
└── README.md
```

## 🔑 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trading_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Server
PORT=3000
```

### Frontend (.env.local)
```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

## 🗄️ Database Schema

### Models
- **Organization**: id, name, plan (FREE/PRO)
- **User**: id, email, password_hash, role (ADMIN/RESEARCHER), org_id
- **Strategy**: id, name, description, file_path, user_id, status
- **BacktestResult**: id, strategy_id, sharpe_ratio, max_drawdown, total_return, pnl_series (JSONB), logs

## 🔒 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

### Strategies
- `GET /strategies` - Get all strategies (filtered by role)
- `GET /strategies/:id` - Get strategy by ID
- `POST /strategies` - Upload new strategy
- `PATCH /strategies/:id` - Update strategy
- `DELETE /strategies/:id` - Delete strategy

### Backtest
- `POST /strategies/:id/backtest` - Run backtest
- `GET /strategies/:id/backtest-results` - Get all backtest results
- `GET /strategies/:id/latest-backtest` - Get latest backtest result

## 🚦 Running Tests

```bash
# Backend tests
cd backend
npm run test
npm run test:e2e
npm run test:cov

# Frontend tests
cd frontend
npm run test
npm run test:coverage
```

## 📦 Build for Production

### Backend
```bash
cd backend
npm run build
npm run start:prod
```

### Frontend
```bash
cd frontend
npm run build
npm run start
```

## 🐳 Docker Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: trading_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/trading_db
      JWT_SECRET: your-secret-key

  frontend:
    build: ./frontend
    ports:
      - "3001:3001"
    depends_on:
      - backend

volumes:
  postgres_data:
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- Jake Onyx - Initial work

## 🙏 Acknowledgments

- NestJS community
- Next.js team
- Shadcn/UI for beautiful components
- TradingView for Lightweight Charts

## 📧 Contact

For any questions or support, please email: huuloc2026@gmail.com

---

**Note**: Make sure to change all placeholder values (like JWT secrets, database credentials) before deploying to production.
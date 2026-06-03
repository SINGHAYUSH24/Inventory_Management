# Inventory & Order Management System

A full-stack, high-precision inventory control and order quotation system built using **Next.js**, **Neon (PostgreSQL)**, and **Vercel**. 

This system demonstrates advanced real-time calculation mechanics, role-based protection (Admin vs. Seller), and highly precise unit conversion workflows (e.g., Grams to Kilograms, Liters to Milliliters) backed by safe database types.

---
##Login Credentials:
1. Seller : email- seller@inventory.com
            password - seller123
2. Admin : email - admin@inventory.com
          password -  admin123
## 🌟 Key Features

1. **Role-Based Access Control (RBAC)**:
   - **Admin Control Panel**: Manage catalog products (CRUD), update stock levels, audit physical conversions, and approve/reject orders.
   - **Seller Workspace**: Search/filter items, add to quotation basket, specify quantities in any compatible physical unit (e.g. grams, kg, mL, L, items), preview live pricing, and place order quotations.
2. **High-Precision Conversions**: 
   - Instant calculation of order pricing even when ordered units (e.g., `g`) differ from product base storage units (e.g., `kg`).
   - Prevents incompatible dimensional transactions (e.g. attempting to convert Liters to Kilograms).
3. **Admin Conversion Auditing**:
   - Every order item shows the exact conversion factor, base price, ordered quantity, and final calculated price.
4. **On-Demand DB Initializer**:
   - Built-in visual setup card on the login screen allows developers to connect their Neon database and initialize the tables with mock data instantly.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js App Router, Tailwind CSS v4, Lucide React (Icons).
- **Backend**: Next.js Route Handlers (API endpoints), server-side route guards, cookie-based JWT sessions.
- **Database**: Neon serverless PostgreSQL driver (`@neondatabase/serverless`).
- **Deployment**: Vercel.

### System Interaction Diagram

```mermaid
graph TD
    A[Client Browser] <-->|HTTPS / HTTP-only JWT Cookie| B[Next.js App Server]
    B <-->|Server-side SQL| C[Neon Hosted PostgreSQL]
    
    subgraph Frontend Pages [Client/Server Pages]
        A1[Login / DB Bootstrap]
        A2[Admin Panel - CRUD & Audit]
        A3[Seller Desk - Basket & Live Pricing]
    end
    
    subgraph Backend APIs [Next.js Route Handlers]
        B1[Auth: Login, Logout, Session verification]
        B2[Products: GET, POST, PUT, DELETE]
        B3[Orders: POST place, GET list, PUT approve/reject]
        B4[DB-Init: GET check status, POST create tables]
    end
    
    A --> FrontendPages
    FrontendPages <--> BackendAPIs
    B1 & B2 & B3 & B4 <--> C
```

---

## 🗄️ Database Schema & Data Types

The system uses Neon PostgreSQL. To handle large values and high decimal precision without floating-point errors, we use PostgreSQL's `NUMERIC` data type.

### Key Database Tables

#### 1. `users`
Tracks system users and their authentication roles.
- `id` (`SERIAL PRIMARY KEY`)
- `email` (`VARCHAR(255) UNIQUE NOT NULL`)
- `password_hash` (`VARCHAR(255) NOT NULL`)
- `name` (`VARCHAR(255) NOT NULL`)
- `role` (`VARCHAR(50) NOT NULL`) - `'admin'` or `'seller'`
- `created_at` (`TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`)

#### 2. `products`
Stores products in the inventory with their base pricing metrics.
- `id` (`SERIAL PRIMARY KEY`)
- `name` (`VARCHAR(255) NOT NULL`)
- `sku` (`VARCHAR(100) UNIQUE NOT NULL`)
- `description` (`TEXT`)
- `category` (`VARCHAR(100)`)
- `base_unit` (`VARCHAR(10) NOT NULL`) - `'g'`, `'kg'`, `'L'`, `'mL'`, `'items'`
- `base_price` (`NUMERIC(20, 4) NOT NULL`) - INR rate per 1 unit of `base_unit`. Handles high values.
- `stock_quantity` (`NUMERIC(20, 4) NOT NULL DEFAULT 0.0000`) - Current stock level in `base_unit`.
- `created_at` (`TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`)
- `updated_at` (`TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`)

#### 3. `orders`
Header table for quotations.
- `id` (`SERIAL PRIMARY KEY`)
- `user_id` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`) - User who placed the order.
- `status` (`VARCHAR(50) NOT NULL DEFAULT 'pending'`) - `'pending'`, `'approved'`, `'rejected'`
- `total_price` (`NUMERIC(20, 4) NOT NULL`) - Aggregated cost in INR.
- `created_at` (`TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`)

#### 4. `order_items`
Detailed line items for orders, preserving conversion calculations at the moment of ordering.
- `id` (`SERIAL PRIMARY KEY`)
- `order_id` (`INTEGER REFERENCES orders(id) ON DELETE CASCADE`)
- `product_id` (`INTEGER REFERENCES products(id) ON DELETE SET NULL`)
- `ordered_quantity` (`NUMERIC(20, 4) NOT NULL`) - Quantity input by seller.
- `ordered_unit` (`VARCHAR(10) NOT NULL`) - Unit input by seller (e.g. `g`).
- `base_unit` (`VARCHAR(10) NOT NULL`) - Base unit of product at time of order (e.g. `kg`).
- `base_price` (`NUMERIC(20, 4) NOT NULL`) - Base price at time of order.
- `conversion_factor` (`NUMERIC(20, 8) NOT NULL`) - Applied multiplier (e.g. `0.001` for `g ➔ kg`).
- `calculated_price` (`NUMERIC(20, 4) NOT NULL`) - Calculated INR cost (`ordered_quantity * conversion_factor * base_price`).

---

## 📏 Physical Unit Storage & Conversion Strategy

### Dimensions & Supported Units
We support three physical dimensions, each having compatible units. Conversions can only take place within the same dimension family:

| Dimension | Supported Units | Base Unit (Internal Reference) |
| :--- | :--- | :--- |
| **Weight** | Grams (`g`), Kilograms (`kg`) | `g` (Factor: 1), `kg` (Factor: 1000) |
| **Volume** | Milliliters (`mL`), Liters (`L`) | `mL` (Factor: 1), `L` (Factor: 1000) |
| **Count** | Items (`items`) | `items` (Factor: 1) |

### Conversion Factor Calculation
To convert a quantity from `ordered_unit` to `base_unit`:
$$\text{Conversion Factor} = \frac{\text{ordered\_unit.factorToBase}}{\text{base\_unit.factorToBase}}$$

#### Examples:
1. **Ordered `g` to Base `kg`**:
   $$\text{Conversion Factor} = \frac{1 \text{ (g factor)}}{1000 \text{ (kg factor)}} = 0.001$$
   $$\text{Quantity in Base} = \text{Quantity in Ordered} \times 0.001$$
2. **Ordered `kg` to Base `g`**:
   $$\text{Conversion Factor} = \frac{1000}{1} = 1000$$
3. **Ordered `L` to Base `mL`**:
   $$\text{Conversion Factor} = \frac{1000}{1} = 1000$$

### Price Calculation
$$\text{Calculated Price (INR)} = \text{Ordered Quantity} \times \text{Conversion Factor} \times \text{Base Price}$$

### Applied Boundaries
- **UI Validation**: Sellers can only choose units compatible with the product's dimension (e.g., a dropdown for Rice `kg` will show `kg` and `g`, but hides volume/count units).
- **Backend Verification**: API checks compatibility before database insertion, rejecting anomalous requests.
- **Stock Deductions**: Deductions are applied in `base_unit` when an admin moves status to `'approved'`.

---

## ⚙️ Setup and Installation

### 1. Prerequisites
- **Node.js** (v18 or newer)
- A free account on **[Neon](https://neon.tech/)** to get a PostgreSQL connection string.

### 2. Local Setup
1. Clone the repository and navigate into the folder:
   ```bash
   cd myapp
   ```
2. Install the node packages:
   ```bash
   npm install
   ```
3. Create a `.env.local` file by copying the template:
   ```bash
   copy .env.local.example .env.local
   ```
4. Edit `.env.local` and paste your Neon PostgreSQL connection string inside `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql://neondb_owner:xxxxxx@ep-xxxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Run the local development server:
   ```bash
   npm run dev
   ```
6. Open your browser and navigate to `http://localhost:3000`.

### 3. Initialize & Seed Database
You can initialize the database tables and seed test data using either the command line or the web application:

#### Option A: Command Line (CLI)
After configuring the `DATABASE_URL` in `.env.local`, run the migration script directly from your terminal:
```bash
npm run migrate
```

#### Option B: Web Application (UI)
- Start the dev server (`npm run dev`) and open `http://localhost:3000/login`.
- If database tables are not detected, a yellow **"Database Setup Needed"** alert will be shown.
- Click the **"Initialize Database Tables"** button to run the DDL configuration and seed default data.

---

## 🔒 Test Credentials & Flow Walkthrough

The seeding step creates two default accounts, but you can also register a custom user at any time using the new **Sign Up** link:

| Role | Username | Password | Actions Allowed |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@inventory.com` | `admin123` | Create/Edit/Delete products, View Inventory, Approve/Reject orders. |
| **Seller** | `seller@inventory.com` | `seller123` | Browse catalog, select units, construct basket, place orders. |

### How to Use the System:
1. **Login**: Go to `/login`, click the autofill button for **"Seller Desk"**, and submit.
2. **Order Placement**:
   - Browse catalog products (e.g. Basmati Rice, Fresh Milk, Pink Salt).
   - Click the `+` icon on Basmati Rice (Base unit: `kg`).
   - In the sidebar basket, change the ordered unit from `kg` to `g`.
   - Enter `500` as the quantity. Notice that the conversion indicator instantly shows `500 g ➔ 0.5000 kg` and evaluates the price correctly (e.g. ₹60.00 instead of ₹120.00).
   - Submit the order.
3. **Admin Verification**:
   - Log out, then log in as the **"Admin Panel"**.
   - Navigate to the **"Quotation Logs"** tab.
   - You will see the incoming order #1 with a `pending` status, displaying the exact audit steps: `500 g ➔ 0.5000 kg (Factor: 0.001)`.
   - Click **"Approve"**. The status changes to `approved` and the Basmati Rice stock level decreases by `0.5 kg` in the "Inventory Catalog" tab.

---

## 🚀 Deployment to Vercel

1. Create a new project on Vercel and link your GitHub repository.
2. Under **Environment Variables**, add the environment keys:
   - `DATABASE_URL`: Your production Neon PostgreSQL connection URL.
   - `JWT_SECRET`: A long secure string.
3. Click **Deploy**.
4. Once deployed, open the live URL and navigate to `/login` to trigger the database bootstrap if needed.

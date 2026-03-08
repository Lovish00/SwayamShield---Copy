# SwayamShield 🛡️

SwayamShield is a comprehensive, modern healthcare ecosystem designed to seamlessly connect patients, medical professionals, hospitals, and regional administrators through a unified, high-performance web platform.

## 🌟 The Vision
SwayamShield bridges the critical gap in emergency response and healthcare management. By providing specialized, realtime portals for different user roles, the system ensures that from the moment an emergency ambulance is dispatched to the high-level regional monitoring by administrators, data flows instantly and intelligently.

---

## 🏗️ System Components & Workflows

SwayamShield is divided into four distinct portals, each crafted with a tailored interface and workflow. The architecture consists of a React frontend (`swayamshield/`) and a Node.js backend (`server/`).

### 1. Patient Portal (The Lifeline)
Designed for immediate accessibility and personal health tracking.
* **Emergency Hub**: Features a real-time, simulated **"Ambulance On Route"** tracking map overlay and an **Assigned Emergency Doctor Card** for immediate first-aid guidance. Includes an **Emergency Direct Call** module that instantly connects to the dispatched hospital.
* **Symptom Checker**: Intelligent preliminary evaluation powered by AI.
* **Health Records & Prescriptions**: Secure storage of past diagnoses and medical prescriptions.

### 2. Doctor Portal (The Clinical Workspace)
A focused, distraction-free environment for medical professionals.
* **Dashboard**: Clean overview of the day's schedule. Focuses on active patient queues and documentation.
* **Prescription Management**: Robust workflow allowing doctors to input and save complex medication protocols directly to the database.
* **Schedule Management**: Interactive modal allowing doctors to configure their active shifts.

### 3. Hospital Centre Portal (The Management Grid)
Tools for facility managers to oversee internal operations and staff.
* **Dynamic Department Filtering**: Specialized hubs mapping out Cardiology, Neurology, Orthopedics, and Pediatrics.
* **Department Detail Views**: Deep-dive vertical boards outlining every doctor working within a specific department, including their patient load and credentials.

### 4. Admin Portal (The Command Center)
A macro-level dashboard for regional healthcare administrators.
* **Smart Grid Healthcare Map**: A visually striking glowing grid mapping out active hospitals. Hovering reveals localized live capacity metrics (Beds, Paramedic Ambulances, Doctors Online).
* **Hospital Records Hub**: A scrollable intelligence panel evaluating specific active network clinics metrics at a glance.

---

## 💻 Tech Stack & Architecture

### Frontend (`/swayamshield`)
* **Framework**: React + Vite
* **Styling**: Tailwind CSS (Dark/Light mode via Context)
* **Animations**: Framer Motion
* **Libraries**: Lucide React, Chart.js

### Backend (`/server`)
* **Framework**: Node.js + Express
* **Database**: PostgreSQL (pg)
* **AI Integration**: Google Gemini API powered symptom checking and predictive modeling (`swayamshield/ai-model`).
* **Authentication**: JWT based token verification.

## 🚀 Running the Project Locally

1. **Install Dependencies**:
   Navigate into both directories and install the packages.
   ```bash
   # Terminal 1
   cd swayamshield
   npm install

   # Terminal 2
   cd server
   npm install
   ```

2. **Configure Environment Variables**:
   In the `server/` directory, create a `.env` file with your Postgres URL and Gemini API credentials. (Refer to standard configuration blocks).

3. **Start the Development Servers**:
   ```bash
   # Terminal 1 (Frontend)
   cd swayamshield
   npm run dev

   # Terminal 2 (Backend)
   cd server
   npm run dev
   ```

4. **Access the Portals**:
   Navigate to `http://localhost:5173`. 
   * Patient: Login via the default screen.
   * Doctor: Navigate to `/doctor` and log in securely.
   * Hospital Centre / Admin: Accessible via specific defined routing paths with respective user roles.

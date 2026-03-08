# SwayamShield 🛡️

SwayamShield is a comprehensive, modern healthcare ecosystem designed to seamlessly connect patients, medical professionals, hospitals, and regional administrators through a unified, high-performance web platform.

## 🌟 The Vision
SwayamShield bridges the critical gap in emergency response and healthcare management. By providing specialized, realtime portals for different user roles, the system ensures that from the moment an emergency ambulance is dispatched to the high-level regional monitoring by administrators, data flows instantly and intelligently.

---

## 🏗️ System Components & Workflows

SwayamShield is divided into four distinct portals, each crafted with a tailored interface and workflow.

### 1. Patient Portal (The Lifeline)
Designed for immediate accessibility and personal health tracking.
* **Emergency Hub (`Emergency.jsx`)**: 
  * Features a real-time, simulated **"Ambulance On Route"** tracking map overlay.
  * Displays an **Assigned Emergency Doctor Card**—complete with the active doctor’s details and a direct Indian phone contact number (+91) for immediate first-aid guidance.
  * Includes a dynamic **Emergency Direct Call** module that instantly pulls the dispatched hospital's name and contact, replacing generic AI chatbots with immediate human connection during a crisis.
* **Symptom Checker**: Intelligent preliminary evaluation before booking.
* **Health Records & Prescriptions**: Secure storage of past diagnoses and actively tracked medical prescriptions.

### 2. Doctor Portal (The Clinical Workspace)
A focused, distraction-free environment for medical professionals.
* **Dashboard (`DoctorDashboard.jsx`)**: Clean overview of the day's schedule. Eliminated unnecessary vitals tracking to strictly focus on active patient queues and documentation.
* **Prescription Management**: Robust workflow allowing doctors to input and save complex medication concatenations directly to the database without data mismatch errors.
* **Schedule Management**: Interactive modal allowing doctors to set their active working days and shift hours.
* **Authentication**: Strict role-based login validation. Patient accounts attempting to access the doctor portal are automatically blocked.

### 3. Hospital Centre Portal (The Management Grid)
Tools for facility managers to oversee their internal operations and staff.
* **Dynamic Department Filtering**: Specialized hubs mapping out Cardiology, Neurology, Orthopedics, and Pediatrics.
* **Department Detail Views (`HospitalDepartment.jsx`)**: Deep-dive vertical boards outlining every doctor working within a specific department. Features robust UI fallbacks displaying doctor credentials (MBBS, MD), contact info, and active patient load.

### 4. Admin Portal (The Command Center)
A futuristic, macro-level dashboard for regional healthcare administrators.
* **Smart Grid Healthcare Map (`AdminDashboard.jsx`)**: A visually striking, dark-themed glowing CSS grid. It plots active hospitals as interactive nodes. Hovering over a node reveals live (simulated) capacity metrics including: Valid beds, Paramedic Ambulances, and Doctors Online.
* **Regional Aggregation**: Simulates geolocation to tag the Admin's command center (e.g., "Chandigarh Aggregation") alongside their dynamically fetched user string name.
* **Hospital Records Hub (`HospitalRecords.jsx`)**: A deeply layered, scrollable intelligence panel. It replaces standard tables with detailed performance cards for every registered hospital, allowing instant evaluation of network capacity at a glance.

---

## 💻 Tech Stack & Architecture
* **Frontend Library**: React (Vite)
* **Styling & Theming**: Tailwind CSS (Dark/Light mode native via `ThemeToggle`), custom CSS grids.
* **Animations**: Framer Motion (for staggered dashboard loading and modal popovers).
* **Icons**: Lucide React.
* **State Management**: React Context (`AuthContext`, `ThemeContext`).

## 🚀 Running the Project

1. **Prerequisites**: Ensure you have Node.js installed.
2. **Installation**:
   ```bash
   cd swayamshield
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

## 🔐 Security & Access
The application utilizes strict routing protocols (`PortalLayout.jsx`). Based on the authenticated user's role defined during the login session (`Auth.jsx`), the router dynamically restricts access to the specialized portals, ensuring data privacy and operational integrity.

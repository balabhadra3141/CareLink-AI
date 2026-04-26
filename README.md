# CareLink AI: Smart Resource Allocation System

CareLink AI is a next-generation, community-driven disaster response and resource allocation platform. Built with React, Firebase, and Google Gemini AI, it seamlessly bridges the gap between active community volunteers and specialized NGOs by mathematically routing crisis reports to the most capable teams in real-time.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/React-18.x-blue)
![Vite](https://img.shields.io/badge/Vite-5.x-purple)
![Firebase](https://img.shields.io/badge/Firebase-10.x-orange)

## 🌟 Key Features

### 🧠 Hybrid AI Routing Engine
Our proprietary deterministic Javascript scoring matrix mathematically analyzes incoming emergency reports against all registered NGOs based on:
1. **Location Proximity**
2. **Skill / Focus Area Matching**
3. **Live Volunteer Availability**

The engine guarantees 100% accurate routing, while utilizing **Google Gemini AI** to generate intelligent, human-readable rationale explaining exactly *why* that specific NGO was chosen.

### 🚨 Emergency Multi-NGO Assignment
In disaster scenarios, manpower is critical. If the routing engine detects that the most capable NGO is facing a severe volunteer shortage (fewer than 5 available volunteers), it enters "Emergency Mode". The engine will automatically pull in the 2nd and 3rd place backup NGOs, assigning the crisis to up to 3 organizations simultaneously to ensure maximum ground support.

### 🤝 Multi-NGO Volunteer Architecture
Volunteers are not locked into a single organization. They can browse the live roster of all registered NGOs, view their **Public IDs** and real-time volunteer counts, and concurrently request to join up to **3 different NGOs**. 

### 🏆 Gamification & Impact Tracking
To encourage sustained community participation, CareLink AI features a progressive gamification system. Volunteers unlock badges based on their impact:
- **Observer:** Report your first issue.
- **Active Scout:** Report 3 or more issues.
- **Impact Maker:** Have 1 of your reported issues resolved by an NGO.
- **Community Hero:** Have 3 of your reported issues successfully resolved.

### 🌍 Transparent Public Operations Feed
A live, globally accessible feed provides full transparency. Anyone can view all active and resolved tasks, exactly who reported them, when they occurred, and which NGOs are currently deployed to handle them.

### 🔒 Bank-Grade Account Security
Dedicated Account Security panels allow both Admins and Volunteers to manage their credentials. Powered by Firebase Re-authentication, users must provide their current password to securely authorize email and password updates.

## 💻 Tech Stack

- **Frontend:** React + Vite
- **Styling:** Vanilla CSS (Glassmorphism UI)
- **Icons:** Lucide React
- **Authentication:** Firebase Auth
- **Database:** Firebase Firestore (Real-time NoSQL)
- **AI Integration:** Google GenAI (Gemini-2.5-Flash)

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Hack2Skill_2026
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and add your Firebase and Gemini credentials:
   ```env
   VITE_FIREBASE_API_KEY="your_api_key"
   VITE_FIREBASE_AUTH_DOMAIN="your_auth_domain"
   VITE_FIREBASE_PROJECT_ID="your_project_id"
   VITE_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
   VITE_FIREBASE_APP_ID="your_app_id"
   VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"

   VITE_GEMINI_API_KEY="your_gemini_api_key"
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

## 📐 Architecture & Schema Notes

**Important Note for Developers:** 
If you are migrating from an older version of CareLink, you must wipe your Firestore `users` and `reports` collections. The new architecture transitions Volunteers from a single `ngoId` to `approvedNgos` and `pendingNgos` arrays to support the Multi-NGO features. Similarly, the `reports` schema now utilizes an `assignedNgosIds` array to support the Emergency Multi-NGO Assignment feature.

# 🏠 Nestora

**Nestora** is a smart rental discovery platform designed to help renters find suitable accommodations and assist landlords in managing rental listings efficiently. The platform combines interactive maps, AI-assisted rental search, location-based filtering, and a secure authentication system to improve the rental experience for both renters and property owners.

## ✨ Features

### 👤 Renter Features

* Browse approved rental listings
* Interactive map view powered by MapLibre
* Draw Zone search for location-based discovery
* AI Rental Assistant for natural language rental search
* Save favorite listings
* Send rental inquiries to landlords
* View property details, reviews, and contact information
* Personalized recommendations

### 🏢 Landlord Features

* Submit rental properties
* Manage rental listings
* Monitor inquiry activity
* Track listing approval status
* Update property information

### 🔒 Security Features

* Email verification
* Password recovery and reset
* Strong password validation
* Cloudflare Turnstile anti-bot protection
* Role-based access control
* Secure Supabase Authentication

### 🗺️ Location Features

* Interactive rental map
* Location-aware search
* Draw Zone filtering
* Property markers with detailed information
* Real accommodation listings in Cabadbaran City

---

## 🛠️ Technology Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend & Database

* Supabase
* PostgreSQL

### Authentication

* Supabase Auth
* Cloudflare Turnstile

### AI Integration

* OpenRouter API

### Maps

* MapLibre GL JS
* OpenFreeMap

### Deployment

* Vercel

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/chsrtian/nestora.git
cd nestora
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file and configure the required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
OPENROUTER_API_KEY=
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 📦 Production Build

```bash
npm run lint
npx tsc --noEmit
npm run build
```

---

## 🔐 Environment Variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
OPENROUTER_API_KEY
```

---

## 👨‍💻 Developer

**Christian Roble**

BS Information Technology Student
Caraga State University – Cabadbaran Campus

---

## 📄 License

This project is intended for academic, educational, and portfolio purposes.

---

## ❤️ Acknowledgments

Special thanks to:

* Supabase
* Vercel
* Cloudflare
* OpenRouter
* MapLibre
* OpenStreetMap Community

for providing the technologies that made this project possible.

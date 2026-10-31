# ParkEase

Full-stack smart parking hackathon prototype.

## Stack
- Frontend: React, TypeScript, Vite
- Backend: FastAPI, SQLAlchemy
- Database: SQLite by default

## Run locally

### Backend (PowerShell)
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (new terminal)
```powershell
cd frontend
npm install
npm run dev
```

The frontend uses `VITE_API_URL` if set; otherwise it connects to `http://127.0.0.1:8000`.

## QR features

- Confirmed bookings can display a separate parking-pass QR and payment QR in **My bookings**.
- The parking QR contains a random booking-specific pass token. Operator Gate Control requires the pass token as well as the booking reference and vehicle plate.
- Payment QR uses a UPI intent with the exact booking amount. Set `UPI_ID` on the backend; never expose the receiving UPI ID in frontend source.
- Set `PAYMENT_MODE=upi` to stop the demo backend from marking prepaid bookings paid automatically. The booking remains pending until a real payment provider integration verifies it.
- Scanning a UPI QR is not proof of payment. This version does not include a payment gateway callback or automatic bank verification. Do not use a QR scan or screenshot as proof of funds.
- The browser UI currently supports displaying QR codes and entering the parking token in Gate Control. A camera-based QR scanner is not included.

For a live deployment, configure `UPI_ID` and `PAYMENT_MODE` in the backend service environment. A gateway/provider integration and authentication/authorization are still required before accepting real payments or operating real gates.

## Important demo limitations

The seeded users and role switch are demo-only, not authentication. The app includes simulated slot sensors, gate actions, and video digitisation. SQLite may not persist on ephemeral hosting filesystems.

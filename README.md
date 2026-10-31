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


## QR pass and UPI demo configuration

The customer **My bookings** page can generate a digital parking-pass QR for confirmed and active bookings. The operator **Gate control** page can scan the QR with a supported browser camera, or accept the pass token manually. Camera access requires HTTPS (or localhost) and a browser that supports the BarcodeDetector API. The existing booking-reference/number-plate flow remains available as a demo fallback.

Set `UPI_ID` in the backend environment to enable a dynamic UPI intent QR with the booking amount and reference. The QR only pre-fills a payment in a UPI app; it does **not** prove that money was received. Do not mark a transaction paid based on a scan or a client-side redirect. With `PAYMENT_MODE=upi`, prepaid bookings remain unpaid until an operator checks the actual credit in their bank/UPI app and uses **Gate control → Manual UPI payment verification** to record the UTR. Entry remains blocked until that manual verification succeeds. This is a demo reconciliation flow, not a bank-integrated verification. A production payment flow needs a verified payment gateway/webhook and authenticated operator permissions.

Example backend environment:

```env
UPI_ID=isahibsasan@oksbi
PAYMENT_MODE=upi
```

Install backend dependencies with `pip install -r backend/requirements.txt`; the QR image generator uses `qrcode[pil]`.

**Demo/security note:** the current application has no authenticated customer/operator sessions. The booking QR token is random and validated by the backend, but the surrounding demo API still needs real authentication and role-based authorization before production use. The QR/payment feature is additive and does not introduce a payment gateway.

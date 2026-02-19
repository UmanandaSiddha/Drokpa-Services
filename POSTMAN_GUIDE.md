# Drokpa V1 API - Postman Collection Guide

This Postman collection contains all V1 APIs for Drokpa platform including Tours, Homestays, Bookings, Payments, Bucket List, ILP Onboarding, and Permits.

## 📦 Collection File

**File:** `Drokpa-V1-API.postman_collection.json`

## 🚀 Quick Start

### 1. Import Collection
- Open Postman
- Click **File → Import**
- Select the `Drokpa-V1-API.postman_collection.json` file
- Collection will be imported with all endpoints organized by module

### 2. Set Environment Variables
The collection uses these variables that need to be set:

| Variable | Purpose | Example |
|----------|---------|---------|
| `base_url` | API base URL | `http://localhost:3000/api` |
| `access_token` | JWT access token (after login) | Retrieved after auth |
| `refresh_token` | JWT refresh token | Retrieved after auth |
| `tour_id` | Tour ID | From tour creation/listing |
| `homestay_id` | Homestay ID | From homestay creation/listing |
| `room_id` | Room ID | From room creation |
| `booking_id` | Booking ID | From booking creation |
| `payment_id` | Payment ID | From payment creation |
| `bucketlist_id` | Bucket list ID | From list creation |
| `item_id` | Bucket list item ID | From item addition |
| `permit_id` | Permit ID | From booking details |
| `onboarding_token` | Onboarding invite token | From admin invite |
| `provider_id` | Provider ID | From provider details |
| `itinerary_id` | Tour itinerary ID | From itinerary creation |
| `poi_id` | Point of Interest ID | From POI creation |

---

## 📋 API Flow Guide

### 1️⃣ Authentication Flow

**Start here:** All APIs require authentication (except public endpoints)

```
1. Request OTP → 2. Verify OTP → 3. Sign Up OR Sign In
4. Set access_token & refresh_token variables from response
5. Use access_token in Authorization header for all authenticated endpoints
```

**For User Registration:**
1. POST `/auth/request-otp` → Email
2. POST `/auth/verify-otp` → Email + OTP from email
3. POST `/auth/sign-up` → Complete registration

**For Existing User Login:**
1. POST `/auth/request-otp` → Email
2. POST `/auth/verify-otp` → Email + OTP
3. POST `/auth/sign-in` → Email + Password

**Store tokens in Postman:**
- Copy `accessToken` from response → Set `{{access_token}}` variable
- Copy `refreshToken` from response → Set `{{refresh_token}}` variable

---

### 2️⃣ Tours Management (ADMIN)

**Create Tour:**
1. POST `/tours` (ADMIN role required)
   - Requires: title, description, basePrice, duration, imageUrls
   - Returns: `tour_id`

2. POST `/tours/{tour_id}/itinerary` (ADMIN)
   - Add itinerary days
   - Returns: `itinerary_id`

3. POST `/tours/itinerary/{itinerary_id}/poi/{poi_id}` (ADMIN)
   - Link POIs to itinerary days
   - Specify order of POIs

**View Tours:**
- GET `/tours` → List all active tours
- GET `/tours/{tour_id}` → Get specific tour details

---

### 3️⃣ Homestay Management (HOST)

**Create Homestay:**
1. POST `/homestay` (HOST role required)
   - Requires: name, description, email, phoneNumber, imageUrls
   - Returns: `homestay_id`

2. POST `/homestay/{homestay_id}/rooms` (HOST)
   - Add rooms to homestay
   - Returns: `room_id`

3. POST `/homestay/{homestay_id}/facilities` (HOST)
   - Link facilities to homestay
   - Requires facility IDs

**Manage Room Availability:**
- POST `/room-availability/set` (HOST)
  - Set availability for date range
  - Specify available count per day

- PATCH `/room-availability/update` (HOST)
  - Update availability for specific date

**View Homestays:**
- GET `/homestay` → List all homestays with pagination
- GET `/homestay/nearby` → Get nearby homestays (geolocation)
- GET `/homestay/{homestay_id}` → Get specific homestay
  - Query: `checkIn`, `checkOut` dates

---

### 4️⃣ Booking Workflow

**Create Booking:**

**For Tours:**
```
1. POST `/booking/tour/request`
   - tourId: {{tour_id}}
   - startDate: "YYYY-MM-DD"
   - guests: [{ fullName, email, age, contactNumber, gender }]
   - Returns: booking_id, status: REQUESTED
```

**For Homestays:**
```
1. POST `/booking/homestay/request`
   - homestayId, roomId, checkIn, checkOut
   - guests: [{ fullName, email, age, contactNumber, gender }]
   - Returns: booking_id, status: REQUESTED
```

**Provider Actions (HOST/VENDOR):**
```
2. POST `/booking/{booking_id}/confirm`
   - Status changes: REQUESTED → CONFIRMED
   - Sets 30-minute payment window

OR

2. POST `/booking/{booking_id}/reject`
   - Status changes: REQUESTED → REJECTED
   - Include rejection reason
```

**User Actions:**
```
3. GET `/booking/my-bookings`
   - View all user bookings
   - Filter by status: CONFIRMED, AWAITING_PAYMENT, etc.
```

---

### 5️⃣ Payment Workflow

**Create & Verify Payment:**

```
1. POST `/payment/create`
   - bookingId: {{booking_id}}
   - Returns: razorpayOrderId, amount
   
2. Use razorpayOrderId with Razorpay Payment Gateway
   - Receive: razorpayPaymentId, razorpaySignature
   
3. POST `/payment/verify`
   - razorpayOrderId, razorpayPaymentId, razorpaySignature
   - Verifies signature and marks payment CAPTURED
   - Booking status → COMPLETED (for tours)
```

**Refunds (ADMIN only):**
```
POST `/payment/refund`
- paymentId: {{payment_id}}
- amount: refund amount
- reason: cancellation reason
```

---

### 6️⃣ Bucket List (Shopping Cart)

**Create & Manage List:**

```
1. POST `/bucketlist`
   - tripName: optional
   - Status: DRAFT
   - Returns: bucketlist_id

2. POST `/bucketlist/{bucketlist_id}/item`
   - Add tour or homestay to list
   - Including dates and quantity
   - Returns: item_id

3. PATCH `/bucketlist/{bucketlist_id}/item/{item_id}`
   - Update item quantity or dates

4. POST `/bucketlist/{bucketlist_id}/checkout`
   - Converts items to bookings
   - Status: DRAFT → PENDING_CHECKOUT → CONVERTED_TO_BOOKING
```

---

### 7️⃣ ILP Onboarding [Provider Registration]

**Admin Creates Invite:**
```
1. POST `/onboarding/admin/invite` (ADMIN)
   - email: provider email
   - providerTypes: [TOUR_VENDOR, ILP_VENDOR, etc]
   - expiresIn: days until expiry
   - Returns: onboarding_token
   - Send link to provider: https://app.url/onboard?token={{token}}
```

**Provider Completes:**
```
2. GET `/onboarding/token/{onboarding_token}`
   - Public endpoint - no auth required
   - Returns: onboarding details

3. POST `/onboarding/complete`
   - Authorization: Bearer {{access_token}}
   - onboardingToken, providerName, contactNumber
   - providerTypes confirmed
   - Creates Provider record with user
   - Sets user roles (HOST, VENDOR, GUIDE, etc)
```

**Admin Management:**
```
- GET `/onboarding/admin/all` → List all onboardings
- GET `/onboarding/admin/pending` → Pending completions
- GET `/onboarding/admin/provider/{provider_id}` → Specific provider
```

---

### 8️⃣ Permits (Tour Requirements)

**Automatically Created:**
- For each guest in tour booking with `permitRequired: true`
- Status: starts as REQUIRED

**Submit Permits:**
```
1. GET `/permit/{permit_id}`
   - View permit details and required documents

2. POST `/permit/{permit_id}/submit`
   - passportPhotoId, identityProofId, permitDocumentId
   - Uploads documents
   - Status: SUBMITTED
```

**Admin Approval:**
```
3. PATCH `/permit/{permit_id}/approve` (ADMIN)
   - Status: APPROVED
   - Guest can proceed with travel

OR

3. PATCH `/permit/{permit_id}/reject` (ADMIN)
   - rejectionReason required
   - Status: REJECTED
```

---

## 🔑 Authentication Headers

All authenticated endpoints require:

```
Authorization: Bearer {{access_token}}
```

For endpoints with file uploads or form data:
```
Authorization: Bearer {{access_token}}
Content-Type: multipart/form-data
```

---

## 📊 User Roles

Different endpoints have role-based access:

| Role | Can Do |
|------|--------|
| **USER** (default) | Browse tours/homestays, create bookings, submit permits |
| **ADMIN** | Manage tours, approve permits, handle refunds, create invites |
| **HOST** | Create/manage homestays, confirm/reject homestay bookings |
| **VENDOR** | Manage tours/activities, confirm/reject bookings |
| **GUIDE** | Manage guide services |

---

## 💡 Testing Workflow Example

### Complete User Journey:

```
1. AUTH - User Registration
   → POST /auth/request-otp
   → POST /auth/verify-otp
   → POST /auth/sign-up
   ✓ Get access_token, store in variable

2. BROWSE - View Tours
   → GET /tours
   → GET /tours/{{tour_id}}

3. CART - Add to Bucket List
   → POST /bucketlist
   → POST /bucketlist/{{bucketlist_id}}/item

4. BOOKING - Create Booking from Cart
   → POST /bucketlist/{{bucketlist_id}}/checkout
   ✓ Creates booking, get booking_id

5. PAYMENT - Complete Payment
   → POST /payment/create
   ✓ Get razorpayOrderId
   → [Go to Razorpay Gateway]
   → POST /payment/verify
   ✓ Booking confirmed

6. PERMITS - Submit Requirements (for tours)
   → GET /permit/booking/{{booking_id}}
   → POST /permit/{{permit_id}}/submit

7. VIEW - Check Booking Status
   → GET /booking/my-bookings
   → GET /booking/{{booking_id}}
```

---

## 🐛 Common Issues & Solutions

### "Unauthorized" Error
- Check `access_token` is set correctly
- Token may have expired - use `/auth/refresh-token` to refresh
- Verify role requirement (ADMIN, HOST, etc.)

### "Booking not found"
- Ensure `booking_id` variable is set correctly
- Booking may not belong to current user

### "Room not available"
- Dates may not have availability set
- Check `/room-availability/` endpoint
- Verify checkIn < checkOut dates

### "Invalid OTP"
- OTP expires after 10 minutes
- Request new OTP if expired
- Check OTP from email carefully

### "Payment verification failed"
- Ensure signature matches from Razorpay
- Verify razorpayOrderId and paymentId are from same transaction
- Check order has CAPTURED status before verifying

---

## 📱 API Response Format

All endpoints return JSON with standard format:

**Success (2xx):**
```json
{
  "data": { /* resource data */ },
  "message": "Success message",
  "statusCode": 200
}
```

**Error (4xx/5xx):**
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "BadRequestException"
}
```

---

## 🔗 Useful Links

- **Razorpay API:** https://razorpay.com/docs/
- **Postman Docs:** https://learning.postman.com/
- **JWT Info:** https://jwt.io/

---

## 📝 Notes

- All dates should be in ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`
- Phone numbers should include country code: `+919876543210`
- ImageUrls should be valid HTTPS URLs
- Pagination: default `limit=10`, `page=1`
- All monetary amounts in **INR (Indian Rupees)** in paise (multiply by 100)

---

## ✅ Next Steps

1. Import collection into Postman
2. Set `base_url` to your API server
3. Start with Authentication section
4. Follow the workflows described above
5. Test each endpoint systematically

Happy API testing! 🚀

# Drokpa V1 — Complete API Reference

**Base URL:** `http://localhost:4000/api/v1` (Dev) · `https://api.drokpa.com/api/v1` (Prod)

All protected endpoints require: `Authorization: Bearer <access_token>`

Tokens and cookies are set automatically by the backend on auth calls (`sign-up`, `sign-in`, `verify-otp`, `refresh-token`, `google`).

---

## Audience Legend

| Label | Who |
|-------|-----|
| `PUBLIC` | No auth required |
| `USER` | Any authenticated user |
| `HOST` | Authenticated user with HOST role (homestay providers) |
| `VENDOR` | Authenticated user with VENDOR role (vehicle partners) |
| `GUIDE` | Authenticated user with GUIDE role (local guides) |
| `PROVIDER` | Any of HOST / VENDOR / GUIDE |
| `ADMIN` | Authenticated user with ADMIN role |

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Onboarding (Provider Invite)](#3-onboarding-provider-invite)
4. [Tours](#4-tours)
5. [Homestays](#5-homestays)
6. [Room Availability](#6-room-availability)
7. [Vehicles](#7-vehicles)
8. [Local Guides](#8-local-guides)
9. [Bookings](#9-bookings)
10. [Payments](#10-payments)
11. [Payouts](#11-payouts)
12. [Permits](#12-permits)
13. [Reviews](#13-reviews)
14. [Bucket List](#14-bucket-list)
15. [Memories](#15-memories)
16. [Points of Interest (POI)](#16-points-of-interest-poi)
17. [Address](#17-address)
18. [File Upload (S3)](#18-file-upload-s3)
19. [Feature Flags](#19-feature-flags)
20. [Community](#20-community)
21. [Service Waitlist](#21-service-waitlist)
22. [Admin Dashboard](#22-admin-dashboard)

---

## 1. Authentication

### POST `/auth/request-otp`
`PUBLIC` · Rate limit: 5/min

Request a 5-minute OTP to verify email ownership.

**Body:**
```json
{ "email": "user@example.com" }
```
**Response 200:**
```json
{ "message": "OTP sent to your email", "email": "user@example.com" }
```

---

### POST `/auth/verify-otp`
`PUBLIC` · Rate limit: 5/min

Verify OTP. Returns JWT access token + sets refresh_token cookie.

**Body:**
```json
{ "email": "user@example.com", "otpString": "123456" }
```
**Response 200:**
```json
{
  "access_token": "eyJ...",
  "user": { "id": "uuid", "email": "user@example.com", "firstName": "John", "roles": ["USER"] }
}
```

---

### POST `/auth/sign-up`
`PUBLIC` · Rate limit: 5/min

Register a new account. Sends verification email.

**Body:**
```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePassword123",
  "phoneNumber": "+919876543210"
}
```
**Response 201:**
```json
{
  "access_token": "eyJ...",
  "user": { "id": "uuid", "email": "user@example.com", "firstName": "John", "lastName": "Doe" }
}
```

---

### POST `/auth/sign-in`
`PUBLIC` · Rate limit: 10/min

Login with email + password.

**Body:**
```json
{ "email": "user@example.com", "password": "SecurePassword123" }
```
**Response 200:** Same shape as sign-up.

---

### POST `/auth/refresh-token`
`PUBLIC` (uses `refresh_token` cookie)

Get a new access token.

**Response 200:**
```json
{ "access_token": "eyJ..." }
```

---

### POST `/auth/logout`
`USER` · No rate limit (requires auth)

Invalidate the current session.

**Response 200:**
```json
{ "message": "Logged out successfully" }
```

---

### POST `/auth/forgot-password`
`PUBLIC` · Rate limit: 3/min

Send password reset link to email.

**Body:**
```json
{ "email": "user@example.com" }
```
**Response 200:**
```json
{ "message": "Password reset link sent to your email" }
```

---

### POST `/auth/reset-password`
`PUBLIC` · Rate limit: 5/min

**Body:**
```json
{ "token": "reset-token-from-email", "password": "NewPassword123" }
```
**Response 200:**
```json
{ "message": "Password reset successfully" }
```

---

### POST `/auth/google`
`PUBLIC` · Rate limit: 10/min

Authenticate via Google Firebase ID token.

**Body:**
```json
{ "idToken": "firebase-id-token", "firstName": "John", "lastName": "Doe" }
```
**Response (new user — 201):**
```json
{ "isNewUser": true, "email": "user@gmail.com", "googleUid": "uid" }
```
**Response (existing user — 200):**
```json
{
  "isNewUser": false,
  "access_token": "eyJ...",
  "data": { "id": "uuid", "email": "user@gmail.com", "roles": ["USER"] }
}
```

> ℹ️ If `isNewUser: true`, frontend should show a name-collection modal then re-call `sign-up` with the Google details.

---

## 2. Users

### GET `/user/me`
`USER`

Get the logged-in user's full profile.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+919876543210",
  "avatarUrl": "https://...",
  "bio": "Travel enthusiast",
  "roles": ["USER"],
  "isVerified": true,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

### PUT `/user/me/profile`
`USER`

Update display profile.

**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": "https://...",
  "bio": "Updated bio"
}
```
**Response 200:** Updated user object.

---

### PUT `/user/me/details`
`USER`

Update email and/or phone number.

**Body:**
```json
{ "email": "newemail@example.com", "phoneNumber": "+919876543210" }
```
**Response 200:** Updated user object.

---

### PUT `/user/me/notifications`
`USER`

Update notification preferences.

**Body:**
```json
{
  "emailNotifications": true,
  "smsNotifications": false,
  "pushNotifications": true,
  "marketingEmails": false
}
```
**Response 200:** Updated preferences object.

---

### GET `/user/me/bookings`
`USER`

**Query:** `?status=CONFIRMED&page=1&limit=10`

Available statuses: `REQUESTED`, `AWAITING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "CONFIRMED",
      "totalAmount": 5000,
      "paidAmount": 5000,
      "createdAt": "2026-01-01T00:00:00Z",
      "items": [{ "productType": "HOMESTAY_HOST", "productId": "uuid", "quantity": 1 }]
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/user/me/reviews`
`USER`

Get all reviews written by the logged-in user.

**Response 200:** Array of review objects.

---

### GET `/user/me/bucket-lists`
`USER`

Get all bucket lists for the logged-in user.

**Response 200:** Array of bucket list objects.

---

### DELETE `/user/me`
`USER`

Soft-delete own account.

**Response 200:**
```json
{ "message": "Account deleted successfully" }
```

---

### GET `/user/admin/all`
`ADMIN`

**Query:** `?search=john&page=1&limit=20`

**Response 200:** Paginated list of users.

---

### GET `/user/admin/:id`
`ADMIN`

Get specific user by ID.

---

### DELETE `/user/admin/:id`
`ADMIN`

Soft-delete a user.

---

### PUT `/user/admin/:id/status`
`ADMIN`

Toggle user's `isActive` flag.

**Response 200:**
```json
{ "id": "uuid", "isActive": false }
```

---

### PUT `/user/admin/:id/verify`
`ADMIN`

Manually mark user email as verified.

---

## 3. Onboarding (Provider Invite)

### GET `/onboarding/token/:token`
`PUBLIC`

Retrieve an onboarding invitation by its magic token. Used by providers clicking their invite email link.

**Response 200:**
```json
{
  "id": "uuid",
  "token": "abc-def-123",
  "email": "provider@example.com",
  "providerType": "HOMESTAY_HOST",
  "status": "PENDING",
  "expiresAt": "2026-02-01T00:00:00Z"
}
```

---

### POST `/onboarding/complete`
`USER`

Provider completes their onboarding using the token from their invite email.

**Body:**
```json
{
  "token": "abc-def-123",
  "providerName": "Mountain View Homestays",
  "providerType": "HOMESTAY_HOST"
}
```
**Response 201:** Created provider object + updated user role.

---

### POST `/onboarding/admin/invite`
`ADMIN`

Invite a new provider to onboard.

**Body:**
```json
{
  "email": "provider@example.com",
  "providerType": "VEHICLE_PARTNER",
  "message": "Welcome to Drokpa!"
}
```
**Response 201:**
```json
{
  "id": "uuid",
  "token": "abc-def-123",
  "email": "provider@example.com",
  "providerType": "VEHICLE_PARTNER",
  "expiresAt": "2026-02-28T00:00:00Z"
}
```

---

### GET `/onboarding/admin/all`
`ADMIN`

**Query:** `?page=1&limit=20`

Get all onboarding invitations.

---

### GET `/onboarding/admin/pending`
`ADMIN`

Get all onboarding invitations with status `PENDING`.

---

### GET `/onboarding/admin/provider/:providerId`
`ADMIN`

Get onboarding record for a specific provider.

---

### DELETE `/onboarding/admin/:id/revoke`
`ADMIN`

Revoke an unused invitation.

---

### PATCH `/onboarding/admin/:id/resend`
`ADMIN`

Resend the invite email for an existing onboarding record.

---

## 4. Tours

> Tours are **platform-managed** (created by Admin). Bookings go through a REQUESTED → AWAITING_PAYMENT → CONFIRMED flow (admin must confirm each tour booking).

### GET `/tours`
`PUBLIC`

**Query:** `?page=1&limit=10&search=himalayan&type=TREK`

Tour types: `TREK`, `ADVENTURE`, `CULTURAL`, `WILDLIFE`, `PILGRIMAGE`, `HERITAGE`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Himalayan Trek",
      "type": "TREK",
      "basePrice": 50000,
      "finalPrice": 50000,
      "discount": 0,
      "duration": 5,
      "maxCapacity": 15,
      "availableSpots": 12,
      "imageUrls": ["https://..."],
      "tags": [{ "label": "mountains" }],
      "rating": 4.8,
      "totalReviews": 24
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/tours/:id`
`PUBLIC`

Get full tour details including itinerary days and POIs.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Himalayan Trek",
  "description": "...",
  "type": "TREK",
  "basePrice": 50000,
  "finalPrice": 50000,
  "duration": 5,
  "maxCapacity": 15,
  "availableSpots": 12,
  "imageUrls": ["https://..."],
  "highlights": ["Mountain views"],
  "included": ["Meals", "Accommodation"],
  "notIncluded": ["Personal expenses"],
  "itinerary": [
    {
      "id": "uuid",
      "dayNumber": 1,
      "title": "Arrival",
      "pois": [{ "id": "uuid", "name": "Base Camp", "order": 1 }]
    }
  ],
  "rating": 4.8,
  "totalReviews": 24
}
```

---

### POST `/tours`
`ADMIN`

Create a new tour.

**Body:**
```json
{
  "title": "Himalayan Trek Adventure",
  "description": "Experience the Himalayas",
  "type": "TREK",
  "price": 50000,
  "duration": 5,
  "imageUrls": ["https://..."],
  "maxCapacity": 15,
  "included": ["Meals", "Accommodation"],
  "notIncluded": ["Travel to base"],
  "highlights": ["Panoramic views"],
  "tags": ["mountains", "adventure"]
}
```
**Response 201:** Created tour object.

---

### PATCH `/tours/:id`
`ADMIN`

Update any tour fields. All fields optional.

**Body:** Partial tour fields.

**Response 200:** Updated tour object.

---

### DELETE `/tours/:id`
`ADMIN`

Deactivate a tour (soft delete).

**Response 200:**
```json
{ "message": "Tour deactivated successfully" }
```

---

### POST `/tours/:id/itinerary`
`ADMIN`

Add an itinerary day to a tour.

**Body:**
```json
{
  "dayNumber": 1,
  "title": "Arrival and Base Camp Setup",
  "details": { "description": "Arrive at base camp", "meals": "Dinner" }
}
```
**Response 201:** Created itinerary day.

---

### POST `/tours/itinerary/:itineraryId/poi/:poiId`
`ADMIN`

Link a POI to an itinerary day.

**Body:**
```json
{ "order": 1 }
```
**Response 201:** Updated itinerary with POI.

---

### PATCH `/tours/itinerary/:itineraryId/reorder`
`ADMIN`

Reorder POIs within an itinerary day.

**Body:**
```json
{ "poiIds": ["uuid1", "uuid2", "uuid3"] }
```
**Response 200:** Updated itinerary.

---

## 5. Homestays

### GET `/homestay`
`PUBLIC`

**Query:** `?page=1&limit=10&search=mountain&bookingCriteria=PER_NIGHT`

Booking criteria: `PER_NIGHT`, `PER_WEEK`, `PER_MONTH`

**Response 200:** Paginated list of homestays with rooms and basic info.

---

### GET `/homestay/nearby`
`PUBLIC`

**Query:** `?latitude=32.23&longitude=77.18&radius=20`

`radius` in km, default 20.

**Response 200:** Array of homestays with `distanceKm` field.

---

### GET `/homestay/provider/my-homestays`
`HOST`

Get all homestays owned by the logged-in host.

**Response 200:** Array of homestay objects.

---

### GET `/homestay/:id`
`PUBLIC`

**Query:** `?checkIn=2026-03-01&checkOut=2026-03-05` (optional, for availability filtering)

**Response 200:** Full homestay with rooms, facilities, tags, availability.

---

### POST `/homestay`
`HOST`

Create a new homestay listing.

**Body:**
```json
{
  "name": "Mountain View Cottage",
  "description": "Cozy cottage with panoramic views",
  "houseRules": ["No smoking", "Quiet after 10 PM"],
  "safetyNSecurity": ["CCTV", "Safe storage"],
  "imageUrls": ["https://..."],
  "displayPrice": 5000,
  "bookingCriteria": "PER_NIGHT",
  "email": "host@example.com",
  "phoneNumber": "+919876543210",
  "addressId": "uuid"
}
```
**Response 201:** Created homestay object.

---

### PATCH `/homestay/:id`
`HOST`

Update a homestay (must be owner).

**Body:** Partial homestay fields.

**Response 200:** Updated homestay object.

---

### POST `/homestay/:id/tags`
`HOST`

Add tags to a homestay.

**Body:**
```json
{ "tagIds": ["uuid1", "uuid2"] }
```
**Response 201:** Updated homestay with tags.

---

### DELETE `/homestay/:id/tags/:tagId`
`HOST`

Remove a specific tag from a homestay.

**Response 200:** Updated homestay.

---

### POST `/homestay/:id/facilities`
`HOST`

Add facilities to a homestay.

**Body:**
```json
{ "facilityIds": ["uuid1", "uuid2"] }
```
**Response 201:** Updated homestay with facilities.

---

### DELETE `/homestay/:id/facilities/:facilityId`
`HOST`

Remove a facility from a homestay.

**Response 200:** Updated homestay.

---

## 6. Room Availability

### POST `/room-availability/:roomId`
`HOST`

Set availability for a date range (upsert operation — safe to call repeatedly).

**Body:**
```json
{
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "available": 3,
  "priceOverride": 5500
}
```
**Response 201:** Array of created/updated availability records.

---

### PATCH `/room-availability/:roomId/date`
`HOST`

Update a single date's availability count or price.

**Body:**
```json
{
  "date": "2026-03-15",
  "available": 2,
  "priceOverride": 6000
}
```
**Response 200:** Updated availability record.

---

### POST `/room-availability/:roomId/block`
`HOST`

Block a date range (sets available = 0). Useful for maintenance/personal use.

**Body:**
```json
{
  "startDate": "2026-03-10",
  "endDate": "2026-03-12"
}
```
**Response 201:** Array of blocked availability records.

---

### DELETE `/room-availability/:roomId`
`HOST`

**Query:** `?startDate=2026-03-01&endDate=2026-03-31`

Permanently delete availability records for a date range.

**Response 200:**
```json
{ "count": 30, "message": "30 availability records deleted" }
```

---

### GET `/room-availability/homestay/:homestayId`
`HOST`

**Query:** `?startDate=2026-03-01&endDate=2026-03-31`

Get availability summary for all rooms in a homestay. Used for the host dashboard calendar.

**Response 200:**
```json
{
  "homestayId": "uuid",
  "period": { "startDate": "2026-03-01", "endDate": "2026-03-31" },
  "rooms": [
    {
      "roomId": "uuid",
      "roomName": "Deluxe Room",
      "availability": [
        { "date": "2026-03-01", "available": 3, "priceOverride": null }
      ]
    }
  ]
}
```

---

### GET `/room-availability/:roomId`
`PUBLIC`

**Query:** `?startDate=2026-03-01&endDate=2026-03-31`

Get availability for a specific room. Used by booking flow and frontend calendar.

**Response 200:**
```json
[
  { "date": "2026-03-01", "available": 3, "price": 5000 },
  { "date": "2026-03-02", "available": 2, "price": 5500 }
]
```

---

## 7. Vehicles

### GET `/vehicle`
`PUBLIC`

**Query:** `?page=1&limit=10&type=SUV&isActive=true&search=innova`

Vehicle types: `SUV`, `SEDAN`, `HATCHBACK`, `TEMPO_TRAVELLER`, `BUS`, `BIKE`, `OTHER`

**Response 200:** Paginated list of vehicles with provider info.

---

### GET `/vehicle/nearby`
`PUBLIC`

**Query:** `?latitude=32.23&longitude=77.18&radius=20`

**Response 200:** Array of vehicles with `distanceKm` field, sorted by distance.

---

### GET `/vehicle/provider/my-vehicles`
`VENDOR`

Get all vehicles owned by the logged-in vendor.

---

### GET `/vehicle/:id`
`PUBLIC`

Get a specific vehicle by ID.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Toyota Innova",
  "type": "SUV",
  "brand": "Toyota",
  "model": "Innova Crysta",
  "registrationNo": "HP-01-AB-1234",
  "imageUrls": ["https://..."],
  "basePricePerDay": 5000,
  "bookingMode": ["SELF_DRIVE", "WITH_DRIVER"],
  "isActive": true,
  "provider": { "id": "uuid", "name": "Himalayan Travels" },
  "address": { "city": "Manali", "state": "Himachal Pradesh" },
  "rating": 4.6,
  "totalReviews": 18
}
```

---

### POST `/vehicle`
`VENDOR`

Create a new vehicle listing.

**Body:**
```json
{
  "name": "Toyota Innova",
  "type": "SUV",
  "brand": "Toyota",
  "model": "Innova Crysta",
  "registrationNo": "HP-01-AB-1234",
  "imageUrls": ["https://..."],
  "basePricePerDay": 5000,
  "bookingMode": ["WITH_DRIVER"],
  "isActive": true,
  "addressId": "uuid"
}
```
**Response 201:** Created vehicle object.

---

### PATCH `/vehicle/:id`
`VENDOR`

Update a vehicle (must be owner).

**Body:** Partial vehicle fields.

**Response 200:** Updated vehicle object.

---

### DELETE `/vehicle/:id`
`VENDOR`

Delete a vehicle. Blocked if it has active bookings — deactivate instead.

**Response 200:**
```json
{ "message": "Vehicle deleted successfully" }
```

---

## 8. Local Guides

### GET `/local-guide`
`PUBLIC`

**Query:** `?page=1&limit=10&search=trekking`

**Response 200:** Paginated list of guides, sorted by rating.

---

### GET `/local-guide/nearby`
`PUBLIC`

**Query:** `?latitude=32.23&longitude=77.18&radius=30`

**Response 200:** Array of guides with `distanceKm`, sorted by distance.

---

### GET `/local-guide/provider/my-guides`
`GUIDE`

Get all guide profiles owned by the logged-in guide user.

---

### GET `/local-guide/:id`
`PUBLIC`

**Response 200:**
```json
{
  "id": "uuid",
  "bio": "Experienced trek guide with 10 years...",
  "languages": ["English", "Hindi", "Kinnauri"],
  "specialties": ["TREK", "WILDLIFE"],
  "basePricePerDay": 2000,
  "imageUrls": ["https://..."],
  "isActive": true,
  "provider": { "id": "uuid", "name": "Ram Singh" },
  "address": { "city": "Kaza", "state": "Himachal Pradesh" },
  "rating": 4.9,
  "totalReviews": 31
}
```

---

### POST `/local-guide`
`GUIDE`

Create a guide profile.

**Body:**
```json
{
  "bio": "Expert trek guide with 10+ years experience",
  "languages": ["English", "Hindi"],
  "specialties": ["TREK", "ADVENTURE"],
  "basePricePerDay": 2000,
  "imageUrls": ["https://..."],
  "isActive": true,
  "addressId": "uuid"
}
```
**Response 201:** Created guide object.

---

### PATCH `/local-guide/:id`
`GUIDE`

Update a guide profile (must be owner).

**Body:** Partial guide fields.

**Response 200:** Updated guide object.

---

### DELETE `/local-guide/:id`
`GUIDE`

Delete a guide profile. Blocked if active bookings exist.

**Response 200:**
```json
{ "message": "Guide deleted successfully" }
```

---

## 9. Bookings

> **Booking flow by type:**
> - **Tour:** User requests → Admin confirms → User pays
> - **Homestay:** User requests → Host confirms → User pays
> - **Vehicle:** User requests → Vendor confirms → User pays
> - **Local Guide:** User requests → Guide (Vendor) confirms → User pays

### POST `/booking/tour/request`
`USER`

Request a tour booking.

**Body:**
```json
{
  "tourId": "uuid",
  "startDate": "2026-04-01",
  "endDate": "2026-04-06",
  "participants": 2,
  "specialRequests": "Vegetarian meals"
}
```
**Response 201:**
```json
{
  "id": "uuid",
  "status": "REQUESTED",
  "totalAmount": 100000,
  "expiresAt": null,
  "items": [{ "productType": "TOUR_VENDOR", "productId": "uuid", "quantity": 2 }]
}
```

---

### POST `/booking/homestay/request`
`USER`

Request a homestay booking.

**Body:**
```json
{
  "homestayId": "uuid",
  "roomId": "uuid",
  "checkIn": "2026-04-01",
  "checkOut": "2026-04-05",
  "guests": 2
}
```
**Response 201:** Booking object with status `REQUESTED`.

---

### POST `/booking/vehicle/request`
`USER`

Request a vehicle booking. Returns 409 if vehicle already booked for those dates.

**Body:**
```json
{
  "vehicleId": "uuid",
  "startDate": "2026-04-01",
  "endDate": "2026-04-05",
  "totalAmount": 20000
}
```
**Response 201:** Booking object with status `REQUESTED`.

---

### POST `/booking/guide/request`
`USER`

Request a local guide booking. Returns 409 if guide already booked for those dates.

**Body:**
```json
{
  "guideId": "uuid",
  "startDate": "2026-04-01",
  "endDate": "2026-04-03",
  "totalAmount": 6000
}
```
**Response 201:** Booking object with status `REQUESTED`.

---

### POST `/booking/:id/confirm`
`HOST` or `VENDOR`

Provider confirms a booking request. Moves booking to `AWAITING_PAYMENT` and starts payment window timer.

**Body:**
```json
{ "paymentWindowMinutes": 60 }
```
**Response 200:** Updated booking object with `expiresAt` set.

---

### POST `/booking/:id/reject`
`HOST` or `VENDOR`

Provider rejects a booking request.

**Body:**
```json
{ "reason": "Property unavailable due to maintenance" }
```
**Response 200:** Updated booking object with status `REJECTED`.

---

### GET `/booking/my-bookings`
`USER`

**Query:** `?status=CONFIRMED&page=1&limit=10`

Get the logged-in user's own bookings.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "CONFIRMED",
      "totalAmount": 5000,
      "paidAmount": 5000,
      "createdAt": "2026-01-01T00:00:00Z",
      "items": [...]
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/booking/provider/bookings`
`HOST` or `VENDOR`

**Query:** `?status=REQUESTED&page=1&limit=10`

Get all bookings for the logged-in provider across their products.

**Response 200:** Same shape as `/booking/my-bookings`.

---

### GET `/booking/:id`
`USER`

Get a single booking by ID. Users can only view their own; providers can view bookings related to their products.

**Response 200:** Full booking with items, payment status, permits.

---

## 10. Payments

> Payments use Razorpay. Flow: Create Razorpay order → Collect on frontend → Verify signature.

### POST `/payment/create`
`USER` · Returns 200

Initiate a Razorpay payment order for a booking in `AWAITING_PAYMENT` status.

**Body:**
```json
{
  "bookingId": "uuid",
  "amount": 100000,
  "currency": "INR",
  "notes": "Tour booking payment"
}
```
**Response 200:**
```json
{
  "orderId": "order_ABC123",
  "amount": 100000,
  "currency": "INR",
  "paymentId": "uuid",
  "keyId": "rzp_live_XXXX"
}
```

> ⚠️ `amount` must exactly match the booking total — server validates this and rejects mismatches.

---

### POST `/payment/verify`
`USER` · Returns 200

Verify Razorpay payment signature after user completes payment on frontend.

**Body:**
```json
{
  "paymentId": "uuid",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash"
}
```
**Response 200:**
```json
{
  "success": true,
  "booking": { "id": "uuid", "status": "CONFIRMED", "paidAmount": 100000 }
}
```

---

### GET `/payment/booking/:bookingId`
`USER`

Get all payment records for a specific booking (user can only see their own).

**Response 200:** Array of payment objects.

---

### GET `/payment/:id`
`USER`

Get a single payment by ID.

**Response 200:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "amount": 100000,
  "currency": "INR",
  "status": "CAPTURED",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "capturedAt": "2026-01-01T00:00:00Z"
}
```

---

### POST `/payment/refund`
`ADMIN` · Returns 200

Initiate a refund for a captured payment.

**Body:**
```json
{
  "paymentId": "uuid",
  "amount": 50000,
  "reason": "Partial cancellation by user"
}
```
**Response 200:** Refund object from Razorpay.

---

## 11. Payouts

> Payouts are admin-managed. After a booking is COMPLETED and payment is CAPTURED, admin creates a payout record for the provider.

### GET `/payout/my-payouts`
`HOST` / `VENDOR` / `GUIDE`

**Query:** `?status=PENDING&page=1&limit=10`

Get all payout records for the logged-in provider, with summary stats.

**Response 200:**
```json
{
  "data": [...],
  "meta": { "total": 5, "page": 1, "limit": 10 },
  "summary": {
    "pending": 2,
    "completed": 3,
    "totalEarned": 45000,
    "totalPending": 20000
  }
}
```

---

### GET `/payout/:id`
`USER` / `ADMIN`

Get a single payout. Providers can only view their own payouts.

**Response 200:**
```json
{
  "id": "uuid",
  "amount": 10000,
  "platformFee": 500,
  "netAmount": 9500,
  "status": "PENDING",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "provider": { "id": "uuid", "name": "Mountain View Cottage" }
}
```

---

### POST `/payout`
`ADMIN`

Create a payout record for a completed booking item.

**Body:**
```json
{
  "bookingItemId": "uuid",
  "providerId": "uuid",
  "amount": 10000,
  "platformFee": 500,
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31"
}
```
**Response 201:** Created payout object.

---

### GET `/payout/admin/all`
`ADMIN`

**Query:** `?status=PENDING&page=1&limit=20`

Get all payouts across all providers.

---

### GET `/payout/admin/provider/:providerId`
`ADMIN`

Get all payouts for a specific provider.

---

### PATCH `/payout/:id/complete`
`ADMIN`

Mark a payout as completed (transferred to provider).

**Response 200:** Updated payout with status `COMPLETED`.

---

### PATCH `/payout/:id/fail`
`ADMIN`

Mark a payout as failed.

**Response 200:** Updated payout with status `FAILED`.

---

## 12. Permits

> Permits are automatically created when a tour booking is confirmed. They must be submitted by the user and then approved by the admin.

> **Permit status flow:** `REQUIRED` → `COLLECTING_DOCS` → `SUBMITTED` → `APPROVED` | `REJECTED`

### POST `/permit/:id/submit`
`USER`

Submit permit application with travel documents.

**Body:**
```json
{
  "passportPhotoId": "s3-key-or-uuid",
  "identityProofId": "s3-key-or-uuid"
}
```
**Response 200:** Updated permit with status `SUBMITTED`.

---

### GET `/permit/booking/:bookingId`
`USER`

Get all permits associated with a booking.

**Response 200:** Array of permit objects.

---

### GET `/permit/:id`
`USER`

Get a specific permit (user can only view their own).

**Response 200:**
```json
{
  "id": "uuid",
  "status": "SUBMITTED",
  "passportPhotoId": "s3-key",
  "identityProofId": "s3-key",
  "submittedAt": "2026-01-01T00:00:00Z",
  "bookingItem": { "id": "uuid", "productType": "TOUR_VENDOR" }
}
```

---

### PATCH `/permit/:id/approve`
`ADMIN`

Approve a submitted permit.

**Body:**
```json
{ "permitDocumentId": "uuid-of-issued-permit-document" }
```
**Response 200:** Updated permit with status `APPROVED`.

---

### PATCH `/permit/:id/reject`
`ADMIN`

Reject a submitted permit.

**Body:**
```json
{ "reason": "Incomplete documentation" }
```
**Response 200:** Updated permit with status `REJECTED`.

---

### POST `/permit/:id/document`
`ADMIN`

Upload the official permit document to an approved permit record.

**Body:**
```json
{ "documentId": "s3-key-or-uuid" }
```
**Response 201:** Updated permit with document attached.

---

## 13. Reviews

### POST `/review`
`USER`

Submit a review for a tour, homestay, vehicle, or guide.

**Body:**
```json
{
  "targetType": "TOUR",
  "targetId": "uuid",
  "rating": 5,
  "comment": "Absolutely breathtaking experience!"
}
```
Target types: `TOUR`, `HOMESTAY`, `VEHICLE`, `LOCAL_GUIDE`

**Response 201:** Created review + updated product rating.

---

### PATCH `/review/:id`
`USER`

Update an existing review (must be author).

**Body:**
```json
{ "rating": 4, "comment": "Updated comment" }
```
**Response 200:** Updated review.

---

### DELETE `/review/:id`
`USER`

Delete your own review.

**Response 200:**
```json
{ "message": "Review deleted" }
```

---

### GET `/review/my-reviews`
`USER`

Get all reviews written by the logged-in user.

---

### GET `/review/:targetType/:targetId`
`PUBLIC`

**Query:** `?page=1&limit=10&sort=rating`

Get all reviews for a product. `targetType`: `TOUR`, `HOMESTAY`, `VEHICLE`, `LOCAL_GUIDE`.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Amazing experience!",
      "createdAt": "2026-01-01T00:00:00Z",
      "user": { "id": "uuid", "firstName": "John", "avatarUrl": "https://..." }
    }
  ],
  "meta": { "total": 24, "page": 1, "limit": 10 }
}
```

---

### GET `/review/:id`
`PUBLIC`

Get a single review by ID.

---

## 14. Bucket List

### POST `/bucketlist`
`USER`

Create a new bucket list.

**Body:**
```json
{
  "title": "Spiti Valley Adventure",
  "description": "Dream trip to Spiti",
  "isPublic": false
}
```
**Response 201:** Created bucket list.

---

### GET `/bucketlist`
`USER`

**Query:** `?status=ACTIVE`

Statuses: `ACTIVE`, `COMPLETED`, `ARCHIVED`

Get the logged-in user's bucket lists.

---

### GET `/bucketlist/:id`
`USER`

Get a specific bucket list with all items.

---

### POST `/bucketlist/:id/checkout`
`USER`

Mark a bucket list as completed.

**Response 200:** Updated bucket list with status `COMPLETED`.

---

### POST `/bucketlist/:id/item`
`USER`

Add an item to a bucket list.

**Body:**
```json
{
  "productType": "TOUR",
  "productId": "uuid",
  "notes": "Must do this in spring!"
}
```
**Response 201:** Created bucket list item.

---

### PATCH `/bucketlist/:id/item/:itemId`
`USER`

Update a bucket list item.

**Body:** Partial item fields.

**Response 200:** Updated item.

---

### DELETE `/bucketlist/:id/item/:itemId`
`USER`

Remove an item from a bucket list.

**Response 200:**
```json
{ "message": "Item removed" }
```

---

### DELETE `/bucketlist/:id`
`USER`

Delete an entire bucket list.

**Response 200:**
```json
{ "message": "Bucket list deleted" }
```

---

## 15. Memories

### POST `/memories`
`USER`

Create a memory (travel photo/story post).

**Body:**
```json
{
  "title": "Sunset at Chandrakhani Pass",
  "description": "Witnessed the most beautiful sunset...",
  "imageUrls": ["https://..."],
  "location": "Chandrakhani Pass, Kullu"
}
```
**Response 201:** Created memory object.

---

### GET `/memories`
`PUBLIC`

**Query:** `?userId=uuid&search=sunset`

Get all public memories, optionally filtered by user or search term.

---

### GET `/memories/my-memories`
`USER`

Get all memories created by the logged-in user.

---

### GET `/memories/:id`
`PUBLIC`

Get a specific memory by ID.

---

### PUT `/memories/:id`
`USER`

Update a memory (must be author).

**Body:** Partial memory fields.

**Response 200:** Updated memory.

---

### DELETE `/memories/:id`
`USER`

Delete a memory (must be author).

**Response 200:**
```json
{ "message": "Memory deleted successfully" }
```

---

## 16. Points of Interest (POI)

### GET `/poi`
`PUBLIC`

**Query:** `?page=1&limit=20&search=lake`

Get all POIs.

---

### GET `/poi/nearby`
`PUBLIC`

**Query:** `?latitude=32.23&longitude=77.18&radius=10`

**Response 200:** Array of POIs with `distanceKm`.

---

### GET `/poi/:id`
`PUBLIC`

Get a specific POI.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Chandratal Lake",
  "description": "High-altitude lake at 4,300m",
  "category": "NATURAL",
  "imageUrls": ["https://..."],
  "address": { "latitude": 32.48, "longitude": 77.61 }
}
```

---

### POST `/poi`
`ADMIN`

Create a new POI.

**Body:**
```json
{
  "name": "Chandratal Lake",
  "description": "Beautiful high-altitude lake",
  "category": "NATURAL",
  "imageUrls": ["https://..."],
  "addressId": "uuid"
}
```
**Response 201:** Created POI.

---

### PATCH `/poi/:id`
`ADMIN`

Update a POI.

**Body:** Partial POI fields.

**Response 200:** Updated POI.

---

### DELETE `/poi/:id`
`ADMIN`

Delete a POI.

**Response 200:**
```json
{ "message": "POI deleted" }
```

---

### POST `/poi/:id/itinerary/:itineraryId`
`ADMIN`

Link a POI to a tour itinerary day.

**Body:**
```json
{ "order": 2 }
```
**Response 201:** Linked POI-itinerary record.

---

## 17. Address

> Addresses support PostGIS geolocation for nearby queries.

### POST `/address`
`PUBLIC`

Create a new address.

**Body:**
```json
{
  "street": "Main Bazaar",
  "city": "Kaza",
  "state": "Himachal Pradesh",
  "country": "India",
  "pincode": "172114",
  "latitude": 32.22,
  "longitude": 78.07
}
```
**Response 201:** Created address object.

---

### GET `/address/byId/:id`
`PUBLIC`

Get address by ID.

---

### PUT `/address/byId/:id`
`PUBLIC`

Update an address. All fields optional.

**Body:** Partial address fields.

**Response 200:** Updated address.

---

### GET `/address/nearby`
`PUBLIC`

**Query:** `?latitude=32.22&longitude=78.07&radius=10`

Get addresses within radius. Used internally by nearby endpoints.

---

## 18. File Upload (S3)

> All upload endpoints return a pre-signed URL. The frontend must PUT the file directly to S3 using this URL. The `publicUrl` is the final accessible URL to save in your DB.

### POST `/s3/presigned-url`
`USER`

Get a pre-signed URL for a single file upload.

**Body:**
```json
{
  "uploadType": "AVATAR",
  "contextId": "user-uuid",
  "fileName": "profile.jpg",
  "fileType": "image/jpeg"
}
```

Upload types: `AVATAR`, `HOMESTAY`, `VEHICLE`, `TOUR`, `GUIDE`, `PERMIT`, `MEMORY`, `POI`, `DOCUMENT`

**Response 200:**
```json
{
  "presignedUrl": "https://s3.amazonaws.com/...?X-Amz-Signature=...",
  "publicUrl": "https://bucket.s3.ap-south-1.amazonaws.com/AVATAR/user-uuid/abc123.jpg"
}
```

---

### POST `/s3/presigned-urls`
`USER`

Get pre-signed URLs for multiple files (bulk upload).

**Body:**
```json
{
  "uploadType": "HOMESTAY",
  "contextId": "homestay-uuid",
  "files": [
    { "fileName": "room1.jpg", "fileType": "image/jpeg" },
    { "fileName": "room2.jpg", "fileType": "image/jpeg" }
  ]
}
```
**Response 200:** Array of `{ presignedUrl, publicUrl }` objects.

---

### DELETE `/s3`
`USER`

Delete a file from S3.

**Body:**
```json
{ "key": "AVATAR/user-uuid/abc123.jpg" }
```
**Response 200:**
```json
{ "success": true }
```

---

## 19. Feature Flags

> Used to enable/disable service types on the platform (e.g., temporarily disable VEHICLE_PARTNER bookings).

### GET `/feature-flag`
`PUBLIC`

Get all feature flags.

**Response 200:**
```json
[
  { "serviceType": "VEHICLE_PARTNER", "enabled": true, "message": null },
  { "serviceType": "LOCAL_GUIDE", "enabled": false, "message": "Coming soon in your area" }
]
```

---

### GET `/feature-flag/check/:serviceType`
`PUBLIC`

Check if a specific service is enabled.

**Response 200:**
```json
{ "enabled": false, "message": "Coming soon in your area" }
```

---

### GET `/feature-flag/:serviceType`
`PUBLIC`

Get full feature flag for a specific service type.

---

### PUT `/feature-flag/:serviceType`
`ADMIN`

Enable or disable a service type.

**Body:**
```json
{
  "enabled": false,
  "message": "Temporarily unavailable due to high demand"
}
```
**Response 200:** Updated feature flag.

---

## 20. Community

> Drokpa's internal community join request system for pre-launch user acquisition.

### POST `/community/join`
`PUBLIC`

Submit a request to join the Drokpa community.

**Body:**
```json
{
  "fullName": "Tenzin Dorje",
  "email": "tenzin@example.com",
  "phoneNumber": "+919876543210",
  "location": "Spiti Valley, HP",
  "interests": ["trekking", "photography", "local culture"],
  "message": "I'd love to showcase my region to the world"
}
```
**Response 201:**
```json
{
  "message": "Community join request submitted",
  "data": { "id": "uuid", "email": "tenzin@example.com", "contacted": false }
}
```

---

### GET `/community/check/:email`
`PUBLIC`

Check the status of a join request by email.

**Response 200:**
```json
{
  "data": { "id": "uuid", "email": "tenzin@example.com", "contacted": false }
}
```

---

### GET `/community/admin/requests`
`ADMIN`

**Query:** `?contacted=false&page=1&limit=20`

Get all join requests with pagination.

---

### PATCH `/community/admin/requests/:id/contact`
`ADMIN`

Mark a join request as contacted.

**Body:**
```json
{ "notes": "Called on +91-XXXXXXXX, will follow up next week" }
```
**Response 200:** Updated request.

---

### PATCH `/community/admin/requests/:id/notes`
`ADMIN`

Update notes on a join request.

**Body:**
```json
{ "notes": "Very interested, follow up in March" }
```
**Response 200:** Updated request.

---

### DELETE `/community/admin/requests/:id`
`ADMIN`

Delete a join request.

---

### GET `/community/admin/stats`
`ADMIN`

**Response 200:**
```json
{ "total": 245, "contacted": 182, "pending": 63 }
```

---

## 21. Service Waitlist

> Users can join a waitlist for a service type not yet available in their area.

### POST `/waitlist/join`
`PUBLIC`

Join a waitlist for a specific service.

**Body:**
```json
{
  "email": "user@example.com",
  "name": "Rohan Sharma",
  "phoneNumber": "+919876543210",
  "serviceType": "LOCAL_GUIDE",
  "location": "Lahaul, HP"
}
```
Service types: `HOMESTAY_HOST`, `VEHICLE_PARTNER`, `TOUR_VENDOR`, `LOCAL_GUIDE`

**Response 201:**
```json
{
  "message": "Successfully joined waitlist",
  "data": { "id": "uuid", "serviceType": "LOCAL_GUIDE", "notified": false }
}
```

---

### GET `/waitlist/admin/:serviceType`
`ADMIN`

**Query:** `?page=1&limit=20`

Get all waitlist entries for a service type.

---

### DELETE `/waitlist/admin/:id`
`ADMIN`

Remove an entry from the waitlist.

---

### POST `/waitlist/admin/:serviceType/notify`
`ADMIN`

Send notification emails to all un-notified users on a service type's waitlist, then mark them as notified.

**Response 200:**
```json
{ "notified": 47 }
```

---

### GET `/waitlist/admin/stats`
`ADMIN`

**Response 200:**
```json
[
  { "serviceType": "LOCAL_GUIDE", "total": 120, "notified": 80, "pending": 40 },
  { "serviceType": "VEHICLE_PARTNER", "total": 55, "notified": 30, "pending": 25 }
]
```

---

## 22. Admin Dashboard

> All `/admin/*` routes require `ADMIN` role.

### GET `/admin/dashboard`
`ADMIN`

Platform overview stats.

**Response 200:**
```json
{
  "users": { "total": 1250, "active": 1180, "newLast30Days": 87 },
  "providers": { "total": 45, "verified": 38, "pending": 7 },
  "bookings": {
    "total": 420,
    "byStatus": {
      "REQUESTED": 12, "AWAITING_PAYMENT": 8, "CONFIRMED": 95,
      "COMPLETED": 280, "CANCELLED": 15, "REJECTED": 10
    }
  },
  "revenue": {
    "totalCaptured": 4200000,
    "last30Days": 850000
  }
}
```

---

### GET `/admin/bookings`
`ADMIN`

**Query:** `?status=REQUESTED&page=1&limit=20`

Get all bookings across the platform.

---

### PATCH `/admin/bookings/:id/tour/confirm`
`ADMIN`

Confirm a REQUESTED tour booking. Moves it to AWAITING_PAYMENT and emails the user.

**Body:**
```json
{ "paymentWindowMinutes": 30 }
```
**Response 200:** Updated booking with status `AWAITING_PAYMENT` and `expiresAt`.

---

### PATCH `/admin/bookings/:id/tour/reject`
`ADMIN`

Reject a REQUESTED tour booking. Emails the user.

**Body:**
```json
{ "reason": "Tour not available for selected dates" }
```
**Response 200:** Updated booking with status `REJECTED`.

---

### GET `/admin/providers`
`ADMIN`

**Query:** `?status=PENDING&verified=false&page=1&limit=20`

Provider statuses: `ACTIVE`, `SUSPENDED`, `PENDING`

---

### PATCH `/admin/provider/:id/verify`
`ADMIN`

Mark a provider as verified.

**Response 200:** Updated provider object.

---

### PATCH `/admin/provider/:id/suspend`
`ADMIN`

Suspend a provider.

**Response 200:** Updated provider object.

---

### GET `/admin/payments`
`ADMIN`

Payment analytics summary.

**Response 200:**
```json
{
  "totalRevenue": 4200000,
  "totalRefunded": 80000,
  "capturedCount": 380,
  "failedCount": 12,
  "recentPayments": [...]
}
```

---

### GET `/admin/users`
`ADMIN`

**Query:** `?search=john&page=1&limit=20`

Get all users with pagination.

---

### POST `/admin/cancellation-policy`
`ADMIN`

Create a cancellation policy for a specific product.

**Body:**
```json
{
  "productType": "TOUR_VENDOR",
  "productId": "uuid",
  "hoursBefore": 48,
  "refundPct": 75
}
```
**Response 201:** Created cancellation policy.

---

### GET `/admin/cancellation-policy`
`ADMIN`

**Query:** `?productId=uuid`

Get cancellation policies, optionally filtered by product.

**Response 200:**
```json
[
  { "id": "uuid", "productType": "TOUR_VENDOR", "productId": "uuid", "hoursBefore": 48, "refundPct": 75 },
  { "id": "uuid", "productType": "TOUR_VENDOR", "productId": "uuid", "hoursBefore": 24, "refundPct": 25 }
]
```

---

### PATCH `/admin/cancellation-policy/:id`
`ADMIN`

Update a cancellation policy.

**Body:**
```json
{ "hoursBefore": 72, "refundPct": 90 }
```
**Response 200:** Updated policy.

---

### DELETE `/admin/cancellation-policy/:id`
`ADMIN`

Delete a cancellation policy.

**Response 200:**
```json
{ "message": "Cancellation policy deleted" }
```

---

## Common Error Responses

```json
{ "statusCode": 400, "timestamp": "...", "path": "/api/v1/...", "error": "Validation error message" }
{ "statusCode": 401, "timestamp": "...", "path": "/api/v1/...", "error": "Unauthorized" }
{ "statusCode": 403, "timestamp": "...", "path": "/api/v1/...", "error": "Forbidden resource" }
{ "statusCode": 404, "timestamp": "...", "path": "/api/v1/...", "error": "Record not found" }
{ "statusCode": 409, "timestamp": "...", "path": "/api/v1/...", "error": "Conflict: already booked for these dates" }
{ "statusCode": 422, "timestamp": "...", "path": "/api/v1/...", "error": "Prisma validation error" }
{ "statusCode": 429, "timestamp": "...", "path": "/api/v1/...", "error": "Too many requests" }
{ "statusCode": 500, "timestamp": "...", "path": "/api/v1/...", "error": "Internal server error" }
```

---

## Booking Status Lifecycle

```
REQUESTED → AWAITING_PAYMENT → CONFIRMED → COMPLETED
         ↘ REJECTED           ↘ EXPIRED
         ↘ CANCELLED
```

- **REQUESTED**: User submitted a booking — waiting for provider/admin confirmation
- **AWAITING_PAYMENT**: Confirmed — user must pay within `expiresAt`
- **EXPIRED**: Payment window elapsed without payment
- **CONFIRMED**: Payment captured — booking is locked in
- **COMPLETED**: Service delivered
- **CANCELLED**: Cancelled by user or provider after confirmation
- **REJECTED**: Declined by provider or admin

---

## Payout Status Lifecycle

```
PENDING → COMPLETED
        ↘ FAILED
```

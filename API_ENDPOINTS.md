# Drokpa V1 API Documentation

## Overview

Complete REST API documentation for Drokpa V1 platform. All endpoints return JSON responses and use standard HTTP status codes.

**Base URL:** `http://localhost:3000/api` (Development) | `https://api.drokpa.com` (Production)

**Current Version:** V1

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Tours](#tours)
4. [Homestays](#homestays)
5. [Bookings](#bookings)
6. [Payments](#payments)
7. [Bucket List](#bucket-list)
8. [ILP Onboarding](#ilp-onboarding)
9. [Permits](#permits)
10. [Room Availability](#room-availability)
11. [Reviews](#reviews)
12. [Address](#address)
13. [Memories](#memories)
14. [Local Guides](#local-guides)
15. [Vehicles](#vehicles)
16. [File Upload (S3)](#file-upload-s3)
17. [Feature Flags](#feature-flags)
18. [Admin Dashboard](#admin-dashboard)
19. [Health & Monitoring](#health--monitoring)
20. [Payouts](#payouts)
21. [Webhooks](#webhooks)
22. [Implementation Completeness Check](#implementation-completeness-check)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Request OTP

**POST** `/auth/request-otp`

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": {
    "email": "user@example.com"
  }
}
```

---

### Verify OTP & Login

**POST** `/auth/verify-otp`

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "otpString": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

---

### Sign Up

**POST** `/auth/sign-up`

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePassword123",
  "phoneNumber": "+919876543210"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

---

### Sign In

**POST** `/auth/sign-in`

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "roles": ["USER"]
    }
  }
}
```

---

### Refresh Token

**POST** `/auth/refresh-token`

**Authentication:** None (uses refresh_token from cookies)

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Logout

**POST** `/auth/logout`

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Forgot Password

**POST** `/auth/forgot-password`

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset link sent to your email"
}
```

---

### Reset Password

**POST** `/auth/reset-password`

**Authentication:** None

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### Google OAuth Authentication

**POST** `/auth/google`

**Authentication:** None

**Request Body:**
```json
{
  "idToken": "google-id-token-from-firebase",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 - New User):**
```json
{
  "isNewUser": true,
  "email": "user@gmail.com",
  "googleUid": "google-uid-12345"
}
```

**Response (200 - Existing User):**
```json
{
  "message": "Authenticated successfully",
  "isNewUser": false,
  "data": {
    "id": "uuid",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["USER"]
  }
}
```

**Notes:**
- Frontend receives `isNewUser: true` → show modal to collect full name
- Google email is auto-verified (isVerified = true)
- Supports account linking if email already exists

---

## Users

### Get My Profile

**GET** `/user/me`

**Authentication:** Required

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+919876543210",
  "profileImage": "https://...",
  "bio": "Travel enthusiast",
  "roles": ["USER"]
}
```

---

### Update Profile

**PUT** `/user/me/profile`

**Authentication:** Required

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "profileImage": "https://example.com/image.jpg",
  "bio": "Travel enthusiast"
}
```

**Response (200):** Updated user object

---

### Update Email/Details

**PUT** `/user/me/details`

**Authentication:** Required

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "phoneNumber": "+919876543210"
}
```

**Response (200):** Updated user object

---

### Update Notification Preferences

**PUT** `/user/me/notifications`

**Authentication:** Required

**Request Body:**
```json
{
  "emailNotifications": true,
  "smsNotifications": false,
  "pushNotifications": true,
  "marketingEmails": false
}
```

**Response (200):** Updated preferences object

---

### Get My Bookings

**GET** `/user/me/bookings?page=1&limit=10&status=CONFIRMED`

**Authentication:** Required

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `status` (string): Filter by booking status (PENDING, CONFIRMED, REJECTED, CANCELLED)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "bookingType": "TOUR",
      "status": "CONFIRMED",
      "createdAt": "2026-02-19T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
```

---

### Get My Reviews

**GET** `/user/me/reviews`

**Authentication:** Required

**Response (200):** Array of review objects

---

### Get My Bucket Lists

**GET** `/user/me/bucket-lists`

**Authentication:** Required

**Response (200):** Array of bucket list objects

---

### Delete My Account

**DELETE** `/user/me`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### Get All Users (ADMIN)

**GET** `/user/admin/all?page=1&limit=10&search=john`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search by name or email

**Response (200):** Paginated list of users

---

### Get User by ID (ADMIN)

**GET** `/user/admin/{user_id}`

**Authentication:** Required (ADMIN role)

**Response (200):** User object

---

### Toggle User Status (ADMIN)

**PUT** `/user/admin/{user_id}/status`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "id": "uuid",
  "isActive": true
}
```

---

### Manually Verify User (ADMIN)

**PUT** `/user/admin/{user_id}/verify`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated user object with verified status

---

### Delete User (ADMIN)

**DELETE** `/user/admin/{user_id}`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## Tours

### List Tours

**GET** `/tours?page=1&limit=10&type=TREK&priceMin=1000&priceMax=50000`

**Authentication:** None

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `type` (string): Filter by tour type (TREK, ADVENTURE, CULTURAL)
- `priceMin` (number): Minimum price
- `priceMax` (number): Maximum price
- `search` (string): Search by title

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Himalayan Trek",
      "description": "Amazing trek experience",
      "type": "TREK",
      "price": 50000,
      "duration": 5,
      "maxCapacity": 15,
      "imageUrls": ["https://..."],
      "highlights": ["Mountain views", "Wildlife spotting"]
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 25 }
}
```

---

### Get Tour Details

**GET** `/tours/{tour_id}`

**Authentication:** None

**Response (200):** Detailed tour object with itinerary and POIs

---

### Create Tour (ADMIN)

**POST** `/tours`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "title": "Himalayan Trek Adventure",
  "description": "Experience the majestic Himalayas",
  "type": "TREK",
  "price": 50000,
  "duration": 5,
  "imageUrls": ["https://example.com/image1.jpg"],
  "maxCapacity": 15,
  "included": ["Meals", "Accommodation"],
  "notIncluded": ["Travel to base"],
  "highlights": ["Mountain views"]
}
```

**Response (201):** Created tour object

---

### Update Tour (ADMIN)

**PATCH** `/tours/{tour_id}`

**Authentication:** Required (ADMIN role)

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "price": 55000
}
```

**Response (200):** Updated tour object

---

### Deactivate Tour (ADMIN)

**DELETE** `/tours/{tour_id}`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "success": true,
  "message": "Tour deactivated"
}
```

---

### Add Tour Itinerary Day (ADMIN)

**POST** `/tours/{tour_id}/itinerary`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "dayNumber": 1,
  "title": "Arrival and Base Camp Setup",
  "details": {
    "description": "Arrive at base camp",
    "meals": "Dinner"
  }
}
```

**Response (201):** Created itinerary day

---

### Add POI to Itinerary (ADMIN)

**POST** `/tours/{tour_id}/itinerary/{day_id}/poi`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "poiId": "uuid",
  "sequence": 1,
  "duration": 120
}
```

**Response (201):** Added POI

---

## Homestays

### List Homestays

**GET** `/homestay?page=1&limit=10&bookingCriteria=PER_NIGHT`

**Authentication:** None

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `bookingCriteria` (string): PER_NIGHT, PER_WEEK, PER_MONTH
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price

**Response (200):** Paginated homestay list

---

### Get Nearby Homestays

**GET** `/homestay/nearby?latitude=32.2396&longitude=77.1887&radius=10`

**Authentication:** None

**Query Parameters:**
- `latitude` (number): User latitude (required)
- `longitude` (number): User longitude (required)
- `radius` (number): Search radius in km (default: 10)

**Response (200):** Array of nearby homestays with distance

---

### Get Homestay Details

**GET** `/homestay/{homestay_id}`

**Authentication:** None

**Response (200):** Detailed homestay object with rooms and facilities

---

### Create Homestay (HOST)

**POST** `/homestay`

**Authentication:** Required (HOST role)

**Request Body:**
```json
{
  "name": "Mountain View Cottage",
  "description": "Cozy cottage with panoramic mountain views",
  "houseRules": ["No smoking inside", "Quiet hours after 10 PM"],
  "safetyNSecurity": ["24/7 CCTV", "Safe for valuables"],
  "imageUrls": ["https://example.com/homestay1.jpg"],
  "displayPrice": 5000,
  "bookingCriteria": "PER_NIGHT",
  "email": "host@example.com",
  "phoneNumber": "+919876543210"
}
```

**Response (201):** Created homestay object

---

### Get My Homestays (HOST)

**GET** `/homestay/my-homestays`

**Authentication:** Required (HOST role)

**Response (200):** Array of host's homestays

---

### Update Homestay (HOST)

**PATCH** `/homestay/{homestay_id}`

**Authentication:** Required (HOST role)

**Request Body:** (all fields optional)
```json
{
  "displayPrice": 5500,
  "houseRules": ["No smoking"]
}
```

**Response (200):** Updated homestay object

---

### Add Room (HOST)

**POST** `/homestay/{homestay_id}/rooms`

**Authentication:** Required (HOST role)

**Request Body:**
```json
{
  "name": "Deluxe Room",
  "capacity": 2,
  "basePrice": 5000,
  "totalRooms": 3
}
```

**Response (201):** Created room object

---

### Add Facilities (HOST)

**POST** `/homestay/{homestay_id}/facilities`

**Authentication:** Required (HOST role)

**Request Body:**
```json
{
  "facilityIds": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Facilities added"
}
```

---

## Bookings

### Create Tour Booking

**POST** `/booking/tour/request`

**Authentication:** Required

**Request Body:**
```json
{
  "tourId": "uuid",
  "startDate": "2026-03-15",
  "guests": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "age": 30,
      "contactNumber": "+919876543210",
      "gender": "MALE"
    }
  ]
}
```

**Response (201):** Created booking object

---

### Create Homestay Booking

**POST** `/booking/homestay/request`

**Authentication:** Required

**Request Body:**
```json
{
  "roomId": "uuid",
  "checkIn": "2026-03-15",
  "checkOut": "2026-03-20",
  "rooms": 1,
  "guests": 2,
  "specialRequests": "High floor preferred"
}
```

**Response (201):** Created booking object

---

### Create Vehicle Booking

**POST** `/booking/vehicle/request`

**Authentication:** Required

**Request Body:**
```json
{
  "vehicleId": "uuid",
  "startDate": "2026-03-15",
  "endDate": "2026-03-20",
  "bookingMode": "SELF_DRIVE",
  "guests": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "age": 30,
      "contactNumber": "+919876543210",
      "gender": "MALE"
    }
  ]
}
```

**Response (201):** Created booking object

---

### Create Guide Booking

**POST** `/booking/guide/request`

**Authentication:** Required

**Request Body:**
```json
{
  "guideId": "uuid",
  "startDate": "2026-03-15",
  "endDate": "2026-03-20",
  "guests": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "age": 30,
      "contactNumber": "+919876543210",
      "gender": "MALE"
    }
  ]
}
```

**Response (201):** Created booking object

---

### Get My Bookings

**GET** `/booking/my-bookings?page=1&limit=10&status=CONFIRMED`

**Authentication:** Required

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Booking status filter

**Response (200):** Paginated booking list

---

### Get Booking Details

**GET** `/booking/{booking_id}`

**Authentication:** Required

**Response (200):** Detailed booking object with full relationships

---

### Confirm Booking (HOST/VENDOR)

**POST** `/booking/{booking_id}/confirm`

**Authentication:** Required (HOST/VENDOR role)

**Request Body:**
```json
{
  "notes": "Booking confirmed. Welcome!"
}
```

**Response (200):** Updated booking with CONFIRMED status

---

### Reject Booking (HOST/VENDOR)

**POST** `/booking/{booking_id}/reject`

**Authentication:** Required (HOST/VENDOR role)

**Request Body:**
```json
{
  "reason": "Room not available for selected dates"
}
```

**Response (200):** Updated booking with REJECTED status

---

### Get Provider Bookings (HOST/VENDOR)

**GET** `/booking/provider/bookings?page=1&limit=10&status=PENDING`

**Authentication:** Required (HOST/VENDOR role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Status filter

**Response (200):** Paginated provider booking list

---

## Payments

### Create Payment (Razorpay Order)

**POST** `/payment`

**Authentication:** Required

**Request Body:**
```json
{
  "bookingId": "uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "razorpayOrderId": "order_1234567890",
  "amount": 50000,
  "currency": "INR",
  "status": "CREATED"
}
```

---

### Verify Payment

**POST** `/payment/verify`

**Authentication:** Required

**Request Body:**
```json
{
  "orderId": "order_1234567890",
  "paymentId": "pay_1234567890",
  "signature": "signature_hash"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "id": "uuid",
    "status": "CAPTURED",
    "amount": 50000
  }
}
```

---

### Get Payment Details

**GET** `/payment/{payment_id}`

**Authentication:** Required

**Response (200):** Payment object with booking details

---

### Get Payments for Booking

**GET** `/payment/booking/{booking_id}`

**Authentication:** Required

**Response (200):** Array of payments for booking

---

### Create Refund (ADMIN)

**POST** `/payment/refund`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "paymentId": "uuid",
  "amount": 50000,
  "reason": "Booking cancelled by user"
}
```

**Response (201):** Created refund object

---

## Bucket List

### Create Bucket List

**POST** `/bucket-list`

**Authentication:** Required

**Request Body:**
```json
{
  "tripName": "Summer Vacation 2026"
}
```

**Response (201):** Created bucket list

---

### Get Bucket Lists

**GET** `/bucket-list?page=1&limit=10`

**Authentication:** Required

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated bucket list

---

### Get Bucket List Details

**GET** `/bucket-list/{bucket_list_id}`

**Authentication:** Required

**Response (200):** Bucket list with items

---

### Add Item to Bucket List

**POST** `/bucket-list/{bucket_list_id}/items`

**Authentication:** Required

**Request Body:**
```json
{
  "productType": "TOUR_VENDOR",
  "tourId": "uuid",
  "quantity": 1,
  "startDate": "2026-03-15",
  "endDate": "2026-03-20",
  "metadata": {
    "notes": "With family"
  }
}
```

**Response (201):** Created bucket list item

---

### Update Bucket List Item

**PATCH** `/bucket-list/{bucket_list_id}/items/{item_id}`

**Authentication:** Required

**Request Body:**
```json
{
  "quantity": 2
}
```

**Response (200):** Updated item

---

### Remove Item from Bucket List

**DELETE** `/bucket-list/{bucket_list_id}/items/{item_id}`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Item removed"
}
```

---

### Checkout Bucket List (Convert to Booking)

**POST** `/bucket-list/{bucket_list_id}/checkout`

**Authentication:** Required

**Response (201):**
```json
{
  "bookings": [
    { "id": "uuid", "type": "TOUR" },
    { "id": "uuid", "type": "HOMESTAY" }
  ]
}
```

---

### Delete Bucket List

**DELETE** `/bucket-list/{bucket_list_id}`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Bucket list deleted"
}
```

---

## ILP Onboarding

### Get Onboarding Details by Token

**GET** `/onboarding/{onboarding_token}`

**Authentication:** None

**Response (200):** Onboarding invitation details

---

### Complete Onboarding

**POST** `/onboarding/complete`

**Authentication:** None

**Request Body:**
```json
{
  "onboardingToken": "uuid",
  "providerName": "Himalayan Adventures",
  "contactNumber": "+919876543210",
  "providerTypes": ["TOUR_VENDOR", "ILP_VENDOR"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Provider account created",
  "data": {
    "providerId": "uuid",
    "providerName": "Himalayan Adventures"
  }
}
```

---

### Create Onboarding Invite (ADMIN)

**POST** `/onboarding/invite`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "email": "provider@example.com",
  "contactName": "John Doe"
}
```

**Response (201):** Created invitation

---

### Get All Onboardings (ADMIN)

**GET** `/onboarding?page=1&limit=10`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated onboarding list

---

### Get Pending Onboardings (ADMIN)

**GET** `/onboarding/pending`

**Authentication:** Required (ADMIN role)

**Response (200):** Array of pending onboardings

---

### Get Provider Onboarding (ADMIN)

**GET** `/onboarding/provider/{provider_id}`

**Authentication:** Required (ADMIN role)

**Response (200):** Provider onboarding details

---

## Permits

### Get Permit Details

**GET** `/permit/{permit_id}`

**Authentication:** None

**Response (200):** Permit object with documents and status

---

### Get Permits for Booking

**GET** `/permit/booking/{booking_id}`

**Authentication:** Required

**Response (200):** Array of permits for booking

---

### Submit Permit Documents

**POST** `/permit/{permit_id}/documents`

**Authentication:** Required

**Request Body:**
```json
{
  "documents": [
    {
      "type": "IDENTITY_PROOF",
      "s3Key": "permits/booking-123/identity.pdf"
    }
  ]
}
```

**Response (201):** Updated permit with documents

---

### Approve Permit (ADMIN)

**PATCH** `/permit/{permit_id}/approve`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated permit with APPROVED status

---

### Reject Permit (ADMIN)

**PATCH** `/permit/{permit_id}/reject`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "reason": "Document clarity issue"
}
```

**Response (200):** Updated permit with REJECTED status

---

## Room Availability

### Set Room Availability (HOST)

**POST** `/room-availability/{room_id}/availability`

**Authentication:** Required (HOST role)

**Request Body:**
```json
{
  "date": "2026-03-15",
  "available": true,
  "capacity": 2
}
```

**Response (201):** Created availability record

---

### Get Room Availability

**GET** `/room-availability/{room_id}?startDate=2026-03-15&endDate=2026-03-20`

**Authentication:** None

**Query Parameters:**
- `startDate` (string): ISO date format
- `endDate` (string): ISO date format

**Response (200):** Array of availability records

---

### Update Room Availability (HOST)

**PATCH** `/room-availability/{room_id}/{date}`

**Authentication:** Required (HOST role)

**Request Body:**
```json
{
  "available": false,
  "capacity": 0
}
```

**Response (200):** Updated availability

---

## Reviews

### Create Review

**POST** `/review`

**Authentication:** Required

**Request Body:**
```json
{
  "targetType": "TOUR",
  "targetId": "uuid",
  "rating": 4,
  "comment": "Great experience! Well organized tour."
}
```

**Response (201):** Created review

---

### Get Reviews for Target

**GET** `/review/{targetType}/{targetId}?page=1&limit=10`

**Authentication:** None

**Path Parameters:**
- `targetType` (string): TOUR, HOMESTAY
- `targetId` (string): Target UUID

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated reviews list

---

### Get My Reviews

**GET** `/review/my-reviews`

**Authentication:** Required

**Response (200):** Array of user's reviews

---

### Get Review Details

**GET** `/review/{review_id}`

**Authentication:** None

**Response (200):** Review object with user and target details

---

### Update Review

**PATCH** `/review/{review_id}`

**Authentication:** Required

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Excellent tour!"
}
```

**Response (200):** Updated review

---

### Delete Review

**DELETE** `/review/{review_id}`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Review deleted"
}
```

---

## Address

### Create Address

**POST** `/address`

**Authentication:** None

**Request Body:**
```json
{
  "addressLine1": "123 Mountain Road",
  "addressLine2": "Near Manali Town",
  "city": "Manali",
  "state": "Himachal Pradesh",
  "postalCode": "175131",
  "country": "India",
  "latitude": 32.2396,
  "longitude": 77.1887
}
```

**Response (201):** Created address

---

### Get Address

**GET** `/address/byId/{address_id}`

**Authentication:** None

**Response (200):** Address object

---

### Update Address

**PUT** `/address/byId/{address_id}`

**Authentication:** None

**Request Body:** (all fields optional)
```json
{
  "city": "Manali",
  "postalCode": "175131"
}
```

**Response (200):** Updated address

---

### Get Nearby Addresses

**GET** `/address/nearby?latitude=32.2396&longitude=77.1887&radius=10`

**Authentication:** None

**Query Parameters:**
- `latitude` (number): Latitude (required)
- `longitude` (number): Longitude (required)
- `radius` (number): Search radius in km (default: 10)

**Response (200):** Array of nearby addresses with distance

---

## Memories

### Create Memory

**POST** `/memories`

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Amazing Sunrise",
  "description": "Beautiful sunrise at the peak with family",
  "imageUrls": ["https://example.com/memory1.jpg"],
  "bookingId": "uuid"
}
```

**Response (201):** Created memory

---

### Get My Memories

**GET** `/memories/my-memories`

**Authentication:** Required

**Response (200):** Array of user's memories

---

### Get All Memories

**GET** `/memories?search=sunrise`

**Authentication:** None

**Query Parameters:**
- `search` (string): Search by title

**Response (200):** Array of all memories

---

### Get Memory Details

**GET** `/memories/{memory_id}`

**Authentication:** None

**Response (200):** Memory object with full details

---

### Update Memory

**PUT** `/memories/{memory_id}`

**Authentication:** Required

**Request Body:**
```json
{
  "description": "Updated: Absolutely stunning sunrise!"
}
```

**Response (200):** Updated memory

---

### Delete Memory

**DELETE** `/memories/{memory_id}`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Memory deleted"
}
```

---

## Local Guides

### List All Guides

**GET** `/local-guide?page=1&limit=10`

**Authentication:** None

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated guides list

---

### Get Nearby Guides

**GET** `/local-guide/nearby?latitude=32.2396&longitude=77.1887&radius=30`

**Authentication:** None

**Query Parameters:**
- `latitude` (number): Latitude (required)
- `longitude` (number): Longitude (required)
- `radius` (number): Search radius in km (default: 30)

**Response (200):** Array of nearby guides with distance

---

### Create Guide Profile (GUIDE)

**POST** `/local-guide`

**Authentication:** Required (GUIDE role)

**Request Body:**
```json
{
  "name": "Rahul Singh",
  "languages": ["English", "Hindi"],
  "experience": 5,
  "expertise": ["Trekking", "Cultural Tours"],
  "ratePerDay": 2000,
  "latitude": 32.2396,
  "longitude": 77.1887,
  "bio": "Experienced guide with passion for mountains"
}
```

**Response (201):** Created guide profile

---

### Get My Guides (GUIDE)

**GET** `/local-guide/provider/my-guides`

**Authentication:** Required (GUIDE role)

**Response (200):** Array of guide's profiles

---

### Get Guide Details

**GET** `/local-guide/{guide_id}`

**Authentication:** None

**Response (200):** Guide profile with full details

---

### Update Guide (GUIDE)

**PATCH** `/local-guide/{guide_id}`

**Authentication:** Required (GUIDE role)

**Request Body:**
```json
{
  "ratePerDay": 2500,
  "expertise": ["Trekking", "Cultural Tours", "Photography"]
}
```

**Response (200):** Updated guide

---

### Delete Guide (GUIDE)

**DELETE** `/local-guide/{guide_id}`

**Authentication:** Required (GUIDE role)

**Response (200):**
```json
{
  "success": true,
  "message": "Guide profile deleted"
}
```

---

## Vehicles

### List All Vehicles

**GET** `/vehicle?page=1&limit=10`

**Authentication:** None

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated vehicles list

---

### Get Nearby Vehicles

**GET** `/vehicle/nearby?latitude=32.2396&longitude=77.1887&radius=20`

**Authentication:** None

**Query Parameters:**
- `latitude` (number): Latitude (required)
- `longitude` (number): Longitude (required)
- `radius` (number): Search radius in km (default: 20)

**Response (200):** Array of nearby vehicles with distance

---

### Create Vehicle (VENDOR)

**POST** `/vehicle`

**Authentication:** Required (VENDOR role)

**Request Body:**
```json
{
  "name": "Toyota Innova",
  "type": "SUV",
  "capacity": 7,
  "pricePerKm": 15,
  "ratePerDay": 3000,
  "registrationNumber": "DL01AB1234",
  "latitude": 32.2396,
  "longitude": 77.1887
}
```

**Response (201):** Created vehicle

---

### Get My Vehicles (VENDOR)

**GET** `/vehicle/provider/my-vehicles`

**Authentication:** Required (VENDOR role)

**Response (200):** Array of vendor's vehicles

---

### Get Vehicle Details

**GET** `/vehicle/{vehicle_id}`

**Authentication:** None

**Response (200):** Vehicle object with full details

---

### Update Vehicle (VENDOR)

**PATCH** `/vehicle/{vehicle_id}`

**Authentication:** Required (VENDOR role)

**Request Body:**
```json
{
  "ratePerDay": 3500,
  "pricePerKm": 16
}
```

**Response (200):** Updated vehicle

---

### Delete Vehicle (VENDOR)

**DELETE** `/vehicle/{vehicle_id}`

**Authentication:** Required (VENDOR role)

**Response (200):**
```json
{
  "success": true,
  "message": "Vehicle deleted"
}
```

---

## File Upload (S3)

### Get Presigned URL (Single File)

**POST** `/s3/presigned-url`

**Authentication:** Required

**Request Body:**
```json
{
  "uploadType": "PERMIT",
  "contextId": "uuid",
  "fileName": "permit_document.pdf",
  "fileType": "application/pdf"
}
```

**Response (201):**
```json
{
  "presignedUrl": "https://s3.amazonaws.com/...",
  "s3Key": "permits/booking-123/permit.pdf",
  "uploadType": "PERMIT"
}
```

---

### Get Presigned URLs (Bulk)

**POST** `/s3/presigned-urls`

**Authentication:** Required

**Request Body:**
```json
{
  "uploadType": "HOMESTAY",
  "contextId": "uuid",
  "files": [
    { "fileName": "image1.jpg", "fileType": "image/jpeg" },
    { "fileName": "image2.jpg", "fileType": "image/jpeg" }
  ]
}
```

**Response (201):** Array of presigned URLs

---

### Delete File

**DELETE** `/s3`

**Authentication:** Required

**Request Body:**
```json
{
  "key": "S3_KEY_PATH"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "File deleted"
}
```

---

## Feature Flags

### Get All Feature Flags

**GET** `/feature-flag`

**Authentication:** None

**Response (200):**
```json
{
  "flags": [
    {
      "serviceType": "TOUR_VENDOR",
      "enabled": true,
      "message": null
    },
    {
      "serviceType": "ILP_VENDOR",
      "enabled": true,
      "message": null
    }
  ]
}
```

---

### Check Service Status

**GET** `/feature-flag/check/{serviceType}`

**Authentication:** None

**Path Parameters:**
- `serviceType` (string): TOUR_VENDOR, ILP_VENDOR, HOMESTAY_HOST, GUIDE

**Response (200):**
```json
{
  "enabled": true,
  "message": null
}
```

---

### Get Feature Flag

**GET** `/feature-flag/{serviceType}`

**Authentication:** None

**Response (200):** Feature flag object

---

### Update Feature Flag (ADMIN)

**PUT** `/feature-flag/{serviceType}`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "enabled": true,
  "message": "Service is active"
}
```

**Response (200):** Updated feature flag

---

## Admin Dashboard

### Get Dashboard Stats

**GET** `/admin/dashboard`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "totalUsers": 1250,
  "totalBookings": 456,
  "totalProviders": 89,
  "revenue": 1234567,
  "pendingPayouts": 45000,
  "activeListings": 234
}
```

---

### Get All Bookings (ADMIN)

**GET** `/admin/bookings?page=1&limit=10&status=CONFIRMED`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Booking status filter

**Response (200):** Paginated bookings list

---

### Get All Providers (ADMIN)

**GET** `/admin/providers?page=1&limit=10&verified=true`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `verified` (string): true/false
- `status` (string): ACTIVE, SUSPENDED

**Response (200):** Paginated providers list

---

### Verify Provider (ADMIN)

**PATCH** `/admin/provider/{provider_id}/verify`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated provider with verified status

---

### Suspend Provider (ADMIN)

**PATCH** `/admin/provider/{provider_id}/suspend`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated provider with suspended status

---

### Get Payment Analytics (ADMIN)

**GET** `/admin/payments`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "totalPayments": 456,
  "totalAmount": 2345678,
  "successRate": 98.5,
  "pendingPayments": 5,
  "failedPayments": 2
}
```

---

### Get All Users (ADMIN)

**GET** `/admin/users?page=1&limit=10`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search term

**Response (200):** Paginated users list

---

## Health & Monitoring

### Check Redis Health

**GET** `/health/redis-health`

**Authentication:** None

**Response (200):**
```json
{
  "status": "healthy",
  "redis": "connected",
  "database": "connected",
  "timestamp": "2026-02-19T10:00:00Z"
}
```

---

### Get Queue Stats

**GET** `/health/queue-stats`

**Authentication:** None

**Response (200):**
```json
{
  "emailQueue": {
    "active": 5,
    "waiting": 12,
    "completed": 1234
  },
  "notificationQueue": {
    "active": 2,
    "waiting": 8,
    "completed": 567
  }
}
```

---

### Flush All Queues (ADMIN)

**DELETE** `/health/flush`

**Authentication:** Required (ADMIN role)

**Response (200):**
```json
{
  "success": true,
  "message": "All queues flushed"
}
```

---

## Payouts

### Get My Payouts (Provider)

**GET** `/payout/my-payouts?page=1&limit=10&status=PENDING`

**Authentication:** Required (HOST/VENDOR/GUIDE role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): PENDING, PAID, FAILED

**Response (200):** Paginated payout list

---

### Create Payout (ADMIN)

**POST** `/payout`

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "bookingItemId": "uuid",
  "providerId": "uuid",
  "amount": 45000,
  "platformFee": 4500,
  "periodStart": "2026-02-01",
  "periodEnd": "2026-02-28"
}
```

**Response (201):** Created payout

---

### Get All Payouts (ADMIN)

**GET** `/payout/admin/all?page=1&limit=10&status=PENDING`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Status filter

**Response (200):** Paginated payouts list

---

### Get Provider Payouts (ADMIN)

**GET** `/payout/admin/provider/{provider_id}?page=1&limit=10`

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):** Paginated provider payouts

---

### Get Payout Details

**GET** `/payout/{payout_id}`

**Authentication:** Required

**Response (200):** Payout object with booking and provider details

---

### Mark Payout Processing (ADMIN)

**PATCH** `/payout/{payout_id}/processing`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated payout with processing timestamp

---

### Mark Payout Completed (ADMIN)

**PATCH** `/payout/{payout_id}/complete`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated payout with PAID status

---

### Mark Payout Failed (ADMIN)

**PATCH** `/payout/{payout_id}/fail`

**Authentication:** Required (ADMIN role)

**Response (200):** Updated payout with FAILED status

---

## Status Codes Reference

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Request successful with no response body |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied (insufficient permissions) |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists or conflict occurred |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Server temporarily unavailable |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

---

## Pagination Format

Paginated responses follow this format:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## User Roles

- **USER**: Regular user (default, can create bookings, leave reviews)
- **HOST**: Homestay provider (can manage homestays and rooms)
- **VENDOR**: Transport/Tour vendor (can manage vehicles/tours)
- **GUIDE**: Local guide provider (can manage guide profiles)
- **ADMIN**: Administrator (full access, can manage all resources)

---

## Webhooks

### Handle Razorpay Webhook

**POST** `/webhook/razorpay`

**Authentication:** Signature verification (x-razorpay-signature header)

**Headers:**
```
x-razorpay-signature: <signature-hash>
```

**Request Body:**
```json
{
  "event": "payment.authorized",
  "created_at": 1649078733,
  "contains": ["payment"],
  "data": {
    "entity": {
      "id": "pay_...",
      "amount": 50000,
      "currency": "INR",
      "status": "authorized",
      "method": "card",
      "order_id": "order_..."
    }
  }
}
```

**Response (200):**
```json
{
  "status": "processed",
  "message": "Webhook processed successfully"
}
```

**Supported Events:**
- `payment.authorized` - Payment authorized
- `payment.failed` - Payment failed
- `payment.captured` - Payment captured
- `refund.created` - Refund initiated
- `refund.failed` - Refund failed

**Notes:**
- Webhook signature is validated using RAZORPAY_WEBHOOK_SECRET
- Failed signature verification returns 401 Unauthorized
- Idempotent processing — safe to retry failed deliveries

---

## Rate Limiting

- Default: 100 requests per minute per IP
- Admin endpoints: 50 requests per minute per IP
- Auth endpoints: 5 failed attempts per 15 minutes (IP-based blocking)

---

## Webhook Events

The following events trigger webhooks (configured in admin panel):

- `booking.created`
- `booking.confirmed`
- `booking.rejected`
- `payment.captured`
- `payment.failed`
- `permit.approved`
- `permit.rejected`
- `provider.verified`
- `payout.completed`

---

---

## Implementation Completeness Check

### ✅ Fully Implemented & Documented
- **Authentication** - All endpoints (OTP, signing in/up, refresh, logout, password reset, Google OAuth)
- **Users** - Profile management, bookings, reviews, bucket lists
- **Tours** - Create, list, update, deactivate, itinerary management
- **Homestays & Rooms** - Creation, availability management, tags, facilities
- **Bookings** - Tour, homestay, vehicle, and guide bookings with status management
- **Payments** - Creation, verification, refunds (Razorpay integration)
- **Reviews** - Create, update, delete, view by target
- **Bucket Lists** - Full CRUD with item management
- **Onboarding** - Provider invitation and completion flow
- **Permits** - Document submission and approval workflow
- **Room Availability** - Host can set, update, and block dates
- **Memories** - Create, list, update, delete
- **Local Guides** - CRUD with nearby search
- **Vehicles** - CRUD with nearby search
- **S3 File Upload** - Presigned URL generation for single and bulk uploads
- **Feature Flags** - Enable/disable services at runtime
- **Admin Dashboard** - Stats, bookings, providers, payments management
- **Health Monitoring** - Redis health checks and queue statistics
- **Payouts** - Provider payout tracking and status management
- **Service Waitlist** - Public join + admin management endpoints
- **Community Join Requests** - Public join + admin review/notes/stats

### ❌ Not Implemented (Schema exists but no endpoints/usage)
- **TemporaryUpload** - Designed for tracking temporary S3 uploads, but not integrated
  - *Recommendation*: Use for managing uploaded files before associating to permits/documents
- **Destination** - Pre-built travel destination packages
  - *Recommendation*: Implement as premium feature or remove if not needed

### 📋 Missing Endpoints (Controllers exist but docs outdated)
The following endpoints are implemented but may need doc updates:
- Tours: Add/reorder itinerary POIs endpoints
- Homestays: Add room tags endpoint
- Video/Image management for entities

---

## Contact & Support

For API issues or questions:
- Email: api-support@drokpa.com
- Documentation: https://docs.drokpa.com
- Status Page: https://status.drokpa.com

---

**Last Updated:** February 25, 2026
**API Version:** V1
**Documentation Version:** 1.1

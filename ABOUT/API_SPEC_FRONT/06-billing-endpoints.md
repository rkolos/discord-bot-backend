# Billing Endpoints

All billing endpoints require authentication.

## Table of Contents

1. [Subscription](#81-subscription)
2. [Usage](#82-usage)
3. [Invoices](#83-invoices)

---

## 8.1 Subscription

### 8.1.1 Get Current Subscription

**Endpoint:** `GET /api/me/subscription`

**Description:** Get current user's subscription plan.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "free" | "pro" | "enterprise",
    "name": "string",
    "price": 0,
    "pricePeriod": "month" | "year"
  }
}
```

### 8.1.2 Upgrade Subscription

**Endpoint:** `POST /api/me/subscription/upgrade`

**Description:** Upgrade or change subscription plan.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "planId": "free" | "pro" | "enterprise",
  "pricePeriod": "month" | "year"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "free" | "pro" | "enterprise",
    "name": "string",
    "price": 0,
    "pricePeriod": "month" | "year"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid plan or payment failed
  ```json
  {
    "error": {
      "code": "SUBSCRIPTION_UPGRADE_FAILED",
      "message": "Failed to upgrade subscription"
    }
  }
  ```

### 8.1.3 Cancel Subscription

**Endpoint:** `POST /api/me/subscription/cancel`

**Description:** Cancel current subscription (downgrade to free plan).

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

---

## 8.2 Usage

### 8.2.1 Get Usage Limits

**Endpoint:** `GET /api/me/usage`

**Description:** Get current usage statistics and limits. Поле `isOverLimit === true` означает, что использование по данной категории превысило лимит плана; фронтенд может использовать это для отображения предупреждающих баннеров без дополнительной логики.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:** `200 OK`
```json
{
  "data": {
    "servers": {
      "used": 0,
      "limit": 0,
      "isOverLimit": false
    },
    "members": {
      "used": 0,
      "limit": 0,
      "isOverLimit": false
    },
    "messages": {
      "used": 0,
      "limit": 0,
      "isOverLimit": false
    }
  }
}
```

---

## 8.3 Invoices

### 8.3.1 Get Invoices

**Endpoint:** `GET /api/me/invoices`

**Description:** Get invoice history for current user.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "amount": 0,
      "currency": "string",
      "date": "string",
      "status": "paid" | "pending" | "failed",
      "downloadUrl": "string"
    }
  ],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 8.3.2 Download Invoice

**Endpoint:** `GET /api/me/invoices/:invoiceId/download`

**Description:** Download invoice PDF file.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `invoiceId` (string, required) - Invoice ID

**Response:** `200 OK`
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="invoice-{invoiceId}.pdf"`
- Binary PDF file content

**Error Response:**
- `404 Not Found` - Invoice not found
  ```json
  {
    "error": {
      "code": "INVOICE_NOT_FOUND",
      "message": "Invoice not found"
    }
  }
  ```

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)

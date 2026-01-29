# Public Endpoints

All public endpoints do not require authentication.

## Table of Contents

1. [Features](#41-features)
2. [Pricing Plans](#42-pricing-plans)
3. [Social Proof](#43-social-proof)
4. [Documentation](#44-documentation)
5. [Public Stats](#45-public-stats)

---

## 4.1 Features

**Endpoint:** `GET /api/features`

**Description:** Get list of platform features.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "icon": "string",
      "category": "string"
    }
  ]
}
```

---

## 4.2 Pricing Plans

**Endpoint:** `GET /api/pricing`

**Description:** Get list of pricing plans.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "price": 0,
      "pricePeriod": "month" | "year",
      "description": "string",
      "features": ["string"],
      "highlighted": true,
      "cta": "string"
    }
  ]
}
```

---

## 4.3 Social Proof

**Endpoint:** `GET /api/social-proof`

**Description:** Get list of social proof items (client logos, testimonials).

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "logo": "string",
      "url": "string"
    }
  ]
}
```

---

## 4.4 Documentation

### 4.4.1 Get Documentation Categories

**Endpoint:** `GET /api/docs/categories`

**Description:** Get all documentation categories with articles.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "articles": [
        {
          "id": "string",
          "title": "string",
          "slug": "string",
          "category": "string",
          "content": "string",
          "excerpt": "string",
          "updatedAt": "string"
        }
      ]
    }
  ]
}
```

### 4.4.2 Get Documentation Article

**Endpoint:** `GET /api/docs/:slug`

**Description:** Get documentation article by slug.

**Path Parameters:**
- `slug` (string, required) - Article slug

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "title": "string",
    "slug": "string",
    "category": "string",
    "content": "string",
    "excerpt": "string",
    "updatedAt": "string"
  }
}
```

**Error Response:**
- `404 Not Found` - Article not found
  ```json
  {
    "error": {
      "code": "DOC_ARTICLE_NOT_FOUND",
      "message": "Documentation article not found"
    }
  }
  ```

---

## 4.5 Public Stats

**Endpoint:** `GET /api/stats`

**Description:** Get public platform statistics.

**Response:** `200 OK`
```json
{
  "data": {
    "totalServers": 0,
    "totalUsers": 0,
    "totalMessages": 0
  }
}
```

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)

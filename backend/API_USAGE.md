# Authentication API Usage

## Setup

1. Install dependencies:

```bash
npm install
```

2. (Optional) Create a `.env` file:

```
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

3. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Base URL

`http://localhost:3000/api/auth`

### 1. Sign Up

**POST** `/api/auth/signup`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" // Optional
}
```

Success response (201):

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "1234567890",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

**POST** `/api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Success response (200):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1234567890",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Get Profile (Protected)

**GET** `/api/auth/profile`

Headers:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Success response (200):

```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common status codes:

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid credentials)
- `403` - Forbidden (invalid/expired token)

## Password Requirements

- Minimum 6 characters

## Notes

- Users are stored in-memory (data is lost on server restart)
- For production, replace the in-memory storage with a database
- Store the JWT token securely (e.g., in localStorage or httpOnly cookie)
- Include the token in the `Authorization` header for protected routes: `Bearer YOUR_TOKEN`

# API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

### 1. Register User
**POST** `/register`
- **Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "Password123!"
  }

### 2. Login User
**POST** `/login`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "Password123!"
  }

### 3. Verify OTP
**POST** `/verify-otp`
- **Body:**
  ```json
  {
    "userId": "65d3a...",
    "otp": "123456"
  }

### 4. Logout
**POST** `/logout`
- **Headers:**
  ```json
  {
    "Authorization": "Bearer <token>",
  }


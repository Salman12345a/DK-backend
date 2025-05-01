# Inventory Management System - Software Requirements Specification

## 1. Introduction

### 1.1 Purpose
This document outlines the requirements and specifications for the branch-specific inventory management system. It serves as a guide for frontend developers to implement the user interface and interactions.

### 1.2 Scope
The inventory management system allows branches to:
- Import and manage their own categories and products
- Link products to categories
- Update product details and pricing
- Manage inventory levels
- Handle product variations

## 2. System Overview

### 2.1 System Architecture
- Backend: Node.js with Fastify
- Database: MongoDB
- Authentication: JWT-based

### 2.2 Key Components
1. Default Templates (Admin)
2. Branch Categories
3. Branch Products
4. Product Variations
5. Inventory Management

## 3. Detailed Requirements

### 3.1 Default Templates (Admin)

#### 3.1.1 Category Templates
- **Endpoint**: `POST /api/default-categories`
- **Purpose**: Create default category templates
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "image": "string (URL)",
    "isActive": boolean
  }
  ```

#### 3.1.2 Product Templates
- **Endpoint**: `POST /api/default-products`
- **Purpose**: Create default product templates
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "categoryId": "string",
    "image": "string (URL)",
    "isActive": boolean
  }
  ```

### 3.2 Branch Categories

#### 3.2.1 Import Categories
- **Endpoint**: `POST /api/branch-categories/import`
- **Purpose**: Import categories from default templates
- **Request Body**:
  ```json
  {
    "branchId": "string",
    "categoryIds": ["string"]
  }
  ```

#### 3.2.2 Update Category
- **Endpoint**: `PUT /api/branch-categories/:id`
- **Purpose**: Update branch-specific category details
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "image": "string (URL)",
    "isActive": boolean
  }
  ```

### 3.3 Branch Products

#### 3.3.1 Import Products
- **Endpoint**: `POST /api/branch-products/import`
- **Purpose**: Import products from default templates
- **Request Body**:
  ```json
  {
    "branchId": "string",
    "productIds": ["string"]
  }
  ```

#### 3.3.2 Update Product
- **Endpoint**: `PUT /api/branch-products/:id`
- **Purpose**: Update branch-specific product details
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "categoryId": "string",
    "image": "string (URL)",
    "isActive": boolean,
    "price": number,
    "stock": number
  }
  ```

### 3.4 Product Variations

#### 3.4.1 Add Variation
- **Endpoint**: `POST /api/branch-products/:productId/variations`
- **Purpose**: Add product variations
- **Request Body**:
  ```json
  {
    "name": "string",
    "price": number,
    "stock": number,
    "isActive": boolean
  }
  ```

#### 3.4.2 Update Variation
- **Endpoint**: `PUT /api/branch-products/:productId/variations/:variationId`
- **Purpose**: Update product variation details
- **Request Body**:
  ```json
  {
    "name": "string",
    "price": number,
    "stock": number,
    "isActive": boolean
  }
  ```

## 4. User Interface Requirements

### 4.1 Category Management
- List view of all categories
- Category creation/import form
- Category edit form
- Category status toggle
- Category deletion (if no products linked)

### 4.2 Product Management
- List view of all products
- Product creation/import form
- Product edit form
- Product status toggle
- Product deletion (if no orders exist)

### 4.3 Variation Management
- List view of product variations
- Variation creation form
- Variation edit form
- Variation status toggle
- Stock management interface

### 4.4 Inventory Dashboard
- Overview of total products
- Low stock alerts
- Category-wise product distribution
- Stock level indicators

## 5. Data Models

### 5.1 Category
```typescript
interface Category {
  _id: string;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Product
```typescript
interface Product {
  _id: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  isActive: boolean;
  branchId: string;
  price: number;
  stock: number;
  variations: Variation[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.3 Variation
```typescript
interface Variation {
  _id: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  productId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 6. Error Handling

### 6.1 Common Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error

### 6.2 Error Response Format
```json
{
  "statusCode": number,
  "error": "string",
  "message": "string"
}
```

## 7. Security Requirements

### 7.1 Authentication
- JWT-based authentication required for all endpoints
- Token expiration: 24 hours
- Refresh token mechanism

### 7.2 Authorization
- Role-based access control
- Branch-specific data isolation
- Admin vs Branch user permissions

## 8. Performance Requirements

### 8.1 Response Times
- API response time: < 500ms
- Bulk import operations: < 5s
- Image upload: < 2s

### 8.2 Concurrent Users
- Support for multiple branch users
- Real-time inventory updates
- Concurrent order processing

## 9. Testing Requirements

### 9.1 API Testing
- All endpoints must be tested
- Error scenarios must be covered
- Authentication/Authorization tests
- Data validation tests

### 9.2 Integration Testing
- Category-Product relationships
- Variation management
- Stock updates
- Order processing

## 10. Deployment Requirements

### 10.1 Environment
- Node.js >= 14.x
- MongoDB >= 4.4
- AWS S3 for image storage
- Redis for caching (optional)

### 10.2 Configuration
- Environment variables for sensitive data
- Database connection strings
- AWS credentials
- JWT secrets 
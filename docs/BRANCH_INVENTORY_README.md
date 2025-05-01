# Branch-Based Inventory Management System

This document provides an overview of the branch-based inventory management feature implemented in the DoKirana backend application.

## Overview

The branch-based inventory management system allows:

1. Admin users to create default product and category templates with S3-hosted images
2. Branch owners to import these templates or create custom products and categories
3. Each branch to have its own inventory with branch-specific products and categories
4. Automatic disabling of out-of-stock products based on order modifications

## Components

### Models

- **Category**: Branch-specific categories with S3 image URLs
- **Product**: Branch-specific products with S3 image URLs and availability flags
- **DefaultCategory**: Admin-defined category templates
- **DefaultProduct**: Admin-defined product templates

### AWS S3 Integration

- Images stored in structured S3 bucket with the following structure:
  - `/default/categories/` - Default category images
  - `/default/products/` - Default product images
  - `/branches/{branchId}/categories/` - Branch-specific category images
  - `/branches/{branchId}/products/` - Branch-specific product images

### API Endpoints

#### Admin Endpoints (Default Templates)

| Endpoint                                             | Method | Description                              |
| ---------------------------------------------------- | ------ | ---------------------------------------- |
| `/api/admin/default-categories`                      | GET    | Get all default categories               |
| `/api/admin/default-categories`                      | POST   | Create a new default category with image |
| `/api/admin/default-categories/:id`                  | PUT    | Update a default category                |
| `/api/admin/default-categories/:id`                  | DELETE | Delete a default category                |
| `/api/admin/default-products`                        | GET    | Get all default products                 |
| `/api/admin/default-categories/:categoryId/products` | GET    | Get default products by category         |
| `/api/admin/default-products`                        | POST   | Create a new default product with image  |
| `/api/admin/default-products/:id`                    | PUT    | Update a default product                 |
| `/api/admin/default-products/:id`                    | DELETE | Delete a default product                 |

#### Branch Endpoints (Branch-Specific Inventory)

| Endpoint                                                       | Method | Description                                  |
| -------------------------------------------------------------- | ------ | -------------------------------------------- |
| `/api/branch/:branchId/categories`                             | GET    | Get categories for a branch                  |
| `/api/branch/:branchId/categories`                             | POST   | Create a new category for a branch           |
| `/api/branch/:branchId/categories/import-default`              | POST   | Import default categories to a branch        |
| `/api/branch/categories/:id`                                   | PUT    | Update a branch category                     |
| `/api/branch/categories/:id`                                   | DELETE | Delete a branch category                     |
| `/api/branch/:branchId/products`                               | GET    | Get all products for a branch                |
| `/api/branch/:branchId/categories/:categoryId/products`        | GET    | Get branch products by category              |
| `/api/branch/:branchId/products`                               | POST   | Create a new product for a branch            |
| `/api/branch/:branchId/categories/:categoryId/import-products` | POST   | Import default products to a branch          |
| `/api/branch/products/:id`                                     | PUT    | Update a branch product                      |
| `/api/branch/products/:id`                                     | DELETE | Delete a branch product                      |
| `/api/branch/:branchId/products/disable`                       | PUT    | Disable products based on order modification |

#### Image Upload Endpoints

| Endpoint                                             | Method | Description           |
| ---------------------------------------------------- | ------ | --------------------- |
| `/api/branch/:branchId/categories/:categoryId/image` | POST   | Upload category image |
| `/api/branch/:branchId/products/:productId/image`    | POST   | Upload product image  |

## Usage Examples

### Importing Default Categories to a Branch

```http
POST /api/branch/123456/categories/import-default
```

### Creating a Branch-Specific Product

```http
POST /api/branch/123456/products
Content-Type: multipart/form-data

{
  "name": "Premium Basmati Rice",
  "price": 150,
  "quantity": "1 kg",
  "unit": "kg",
  "categoryId": "789012",
  "branchId": "123456",
  "isPacket": true,
  "description": "Premium long-grain rice"
}
```

### Disabling Products After Order

```http
PUT /api/branch/123456/products/disable
Content-Type: application/json

{
  "productIds": ["product1", "product2"],
  "reason": "Out of Stock"
}
```

## AWS S3 Configuration

1. Create an S3 bucket named `dokirana-images`
2. Configure CORS to allow access from your frontend
3. Set up IAM policies with appropriate permissions
4. Add the following environment variables:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `S3_BUCKET_NAME`

## Implementation Notes

1. The system maintains backward compatibility with existing endpoints
2. Products and categories have an `isActive`/`isAvailable` flag to control visibility
3. Images are stored in both the old `image` field and new `imageUrl` field for compatibility
4. The system tracks creations from templates with the `createdFromTemplate` flag

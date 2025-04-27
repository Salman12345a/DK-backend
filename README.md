# StoreSync-Backend

## Features

- Authentication and user management
- Branch management
- Order processing
- Product and category management
- Wallet integration
- Delivery partner management
- **Branch-based inventory management with AWS S3 integration** (NEW)

## New Feature: Branch-Based Inventory Management

The branch-based inventory management system allows:

1. Admin users to create default product and category templates with S3-hosted images
2. Branch owners to import these templates or create custom products and categories
3. Each branch to have its own inventory with branch-specific products and categories
4. Automatic disabling of out-of-stock products based on order modifications

For detailed documentation, see [BRANCH_INVENTORY_README.md](./BRANCH_INVENTORY_README.md)

## Environment Variables

In addition to the existing environment variables, the following are required for the S3 integration:

```
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
S3_BUCKET_NAME=dokirana-images
```

## Installation

```bash
npm install
```

## Running the Application

```bash
npm start
```

## API Documentation

API documentation is available in the POSTMAN collection.

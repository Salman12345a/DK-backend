# CI/CD Pipeline for StoreSync-Backend

This directory contains the GitHub Actions workflow for automatically deploying the StoreSync-Backend to AWS Elastic Beanstalk.

## Setup Instructions

### 1. Create IAM User in AWS

Create an IAM user with programmatic access and the following permissions:
- `AWSElasticBeanstalkFullAccess`
- `AmazonS3FullAccess` (or more restricted S3 permissions if preferred)

### 2. Set Up GitHub Secrets

In your GitHub repository, go to Settings > Secrets and Variables > Actions, and add the following secrets:

- `AWS_ACCESS_KEY_ID`: Your IAM user's access key
- `AWS_SECRET_ACCESS_KEY`: Your IAM user's secret key
- `AWS_REGION`: The AWS region of your Elastic Beanstalk environment (e.g., `us-east-1`)
- `EB_APPLICATION_NAME`: The name of your Elastic Beanstalk application
- `EB_ENVIRONMENT_NAME`: The name of your Elastic Beanstalk environment

### 3. Configure Elastic Beanstalk

Ensure your Elastic Beanstalk environment is properly configured with:
- Node.js platform
- Environment variables for your application (database credentials, API keys, etc.)

### 4. Triggering Deployments

Deployments will be triggered automatically when:
- Code is pushed to the `main` branch (modify in the workflow file if your production branch is different)
- Manually triggered via GitHub Actions UI (using the "workflow_dispatch" event)

## Customization

- Update the Node.js version in the workflow file if needed
- Modify the excluded files in the `Generate deployment package` step
- Adjust wait times if needed

## Troubleshooting

If deployments fail, check:
1. GitHub Actions logs for detailed error messages
2. AWS Elastic Beanstalk console for environment health and events
3. Verify that all required secrets are set correctly
4. Ensure your application is compatible with Elastic Beanstalk

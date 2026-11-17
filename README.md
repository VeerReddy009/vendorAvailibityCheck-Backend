# Vendor Availability Check API

## Persistent shop images

Shop images are stored in Cloudinary so they remain available after a server
restart or redeploy. Configure these environment variables in the backend
deployment before accepting uploads:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

The Cloudinary credentials are available in the Cloudinary dashboard under
**Settings > API Keys**. Never commit the real values; use the deployment
platform's secret/environment variable settings.

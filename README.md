# Vendor Availability Check API

## Persistent shop images

Shop images are stored in MongoDB GridFS. They remain available after browser
refreshes and backend restarts as long as the configured MongoDB database is
available. No image-storage credentials beyond `MONGODB_URI` are required.

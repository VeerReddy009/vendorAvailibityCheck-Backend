const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { GridFSBucket } = require('mongodb');
const Shop = require('../models/Shop');
const auth = require('../middleware/auth');

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload an image.'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const getImageBucket = () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('Image storage is not available.');
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'shopImages' });
};

const uploadImage = file =>
  new Promise((resolve, reject) => {
    try {
      const bucket = getImageBucket();
      const stream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype
      });

      stream.on('error', reject);
      stream.on('finish', () => resolve({
        fileId: stream.id
      }));
      stream.end(file.buffer);
    } catch (error) {
      reject(error);
    }
  });

const deleteImage = async fileId => {
  if (fileId) {
    await getImageBucket().delete(new mongoose.Types.ObjectId(fileId));
  }
};

// Get all shops (public route)
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 });
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stream a stored shop image from MongoDB GridFS
router.get('/images/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getImageBucket();
    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files.length) {
      return res.status(404).send('Image not found');
    }

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    bucket.openDownloadStream(fileId).on('error', () => {
      if (!res.headersSent) {
        res.status(404).send('Image not found');
      }
    }).pipe(res);
  } catch (error) {
    if (error instanceof mongoose.Error || error.name === 'BSONError') {
      return res.status(404).send('Image not found');
    }
    res.status(500).json({ message: error.message });
  }
});

// Create a new shop (protected route)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const uploadedImage = req.file ? await uploadImage(req.file) : null;
    const shopData = {
      ...req.body,
      ownerId: req.user._id,
      imageUrl: uploadedImage ? `/api/shops/images/${uploadedImage.fileId}` : null,
      imageFileId: uploadedImage ? uploadedImage.fileId : null,
      isOpen: req.body.isOpen === 'true'
    };

    const shop = new Shop(shopData);
    await shop.save();
    res.status(201).json(shop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get shop by ID
router.get('/:id', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    res.json(shop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update shop (protected route - only owner can update)
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (shop.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this shop' });
    }

    const uploadedImage = req.file ? await uploadImage(req.file) : null;
    const updates = {
      ...req.body,
      imageUrl: uploadedImage ? `/api/shops/images/${uploadedImage.fileId}` : shop.imageUrl,
      imageFileId: uploadedImage ? uploadedImage.fileId : shop.imageFileId,
      isOpen: req.body.isOpen === 'true'
    };

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (uploadedImage && shop.imageFileId) {
      await deleteImage(shop.imageFileId);
    }

    res.json(updatedShop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete shop (protected route - only owner can delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (shop.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this shop' });
    }

    if (shop.imageFileId) {
      await deleteImage(shop.imageFileId);
    } else if (shop.imageUrl && shop.imageUrl.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '..', shop.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await shop.deleteOne();
    res.json({ message: 'Shop deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle shop status (open/closed) - protected route
router.patch('/:id/toggle-status', auth, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (shop.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this shop' });
    }

    shop.isOpen = !shop.isOpen;
    await shop.save();
    res.json(shop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

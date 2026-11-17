const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const Shop = require('../models/Shop');
const auth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

const uploadToCloudinary = file =>
  new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
      reject(new Error('Image storage is not configured on the server.'));
      return;
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'vendor-availability-check/shops',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });

const deleteCloudinaryImage = async publicId => {
  if (publicId) {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
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

// Create a new shop (protected route)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const uploadedImage = req.file ? await uploadToCloudinary(req.file) : null;
    const shopData = {
      ...req.body,
      ownerId: req.user._id,
      imageUrl: uploadedImage ? uploadedImage.secure_url : null,
      imagePublicId: uploadedImage ? uploadedImage.public_id : null,
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

    const uploadedImage = req.file ? await uploadToCloudinary(req.file) : null;
    const updates = {
      ...req.body,
      imageUrl: uploadedImage ? uploadedImage.secure_url : shop.imageUrl,
      imagePublicId: uploadedImage ? uploadedImage.public_id : shop.imagePublicId,
      isOpen: req.body.isOpen === 'true'
    };

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (uploadedImage && shop.imagePublicId) {
      await deleteCloudinaryImage(shop.imagePublicId);
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

    if (shop.imagePublicId) {
      await deleteCloudinaryImage(shop.imagePublicId);
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

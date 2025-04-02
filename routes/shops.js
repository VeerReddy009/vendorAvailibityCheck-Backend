const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Shop = require('../models/Shop');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload an image.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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
    const shopData = {
      ...req.body,
      ownerId: req.user._id,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
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

    // Check if user is the owner
    if (shop.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this shop' });
    }

    const updates = {
      ...req.body,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : shop.imageUrl,
      isOpen: req.body.isOpen === 'true'
    };

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

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

    // Check if user is the owner
    if (shop.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this shop' });
    }

    // Delete the shop's image if it exists
    if (shop.imageUrl) {
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

    // Check if user is the owner
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
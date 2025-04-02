const mongoose = require('mongoose');
require('dotenv').config();

// Shop Schema
const shopSchema = new mongoose.Schema({
  ownerName: String,
  shopName: String,
  location: String,
  phoneNumber: String,
  isOpen: Boolean,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Shop = mongoose.model('Shop', shopSchema);

// Dummy data with direct image URLs
const dummyShops = [
  {
    ownerName: "John Smith",
    shopName: "Fresh Groceries",
    location: "123 Main Street, Downtown",
    phoneNumber: "+1 234-567-8901",
    isOpen: true,
    imageUrl: "https://images.pexels.com/photos/1367242/pexels-photo-1367242.jpeg"
  },
  {
    ownerName: "Sarah Johnson",
    shopName: "Tech Gadgets",
    location: "456 Electronics Avenue",
    phoneNumber: "+1 234-567-8902",
    isOpen: false,
    imageUrl: "https://images.pexels.com/photos/1029757/pexels-photo-1029757.jpeg"
  },
  {
    ownerName: "Mike Wilson",
    shopName: "Coffee Corner",
    location: "789 Brew Street",
    phoneNumber: "+1 234-567-8903",
    isOpen: true,
    imageUrl: "https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg"
  },
  {
    ownerName: "Emma Davis",
    shopName: "Fashion Boutique",
    location: "321 Style Street",
    phoneNumber: "+1 234-567-8904",
    isOpen: true,
    imageUrl: "https://images.pexels.com/photos/1884584/pexels-photo-1884584.jpeg"
  },
  {
    ownerName: "David Brown",
    shopName: "Book Haven",
    location: "654 Reading Road",
    phoneNumber: "+1 234-567-8905",
    isOpen: true,
    imageUrl: "https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg"
  }
];

// Connect to MongoDB and insert dummy data
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB Connected');
  
  // Clear existing data
  await Shop.deleteMany({});
  console.log('Cleared existing data');
  
  // Insert dummy data
  await Shop.insertMany(dummyShops);
  console.log('Inserted dummy data');
  
  // Close the connection
  await mongoose.connection.close();
  console.log('Database connection closed');
})
.catch(err => {
  console.error('Error:', err);
}); 
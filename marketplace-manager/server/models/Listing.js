const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema(
  {
    url: String,
    filename: String,
    size: Number,
    mimetype: String,
  },
  { _id: false }
);

const AnalyticsSchema = new mongoose.Schema(
  {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    lastScraped: { type: Date },
    scrapeStatus: { type: String, enum: ['success', 'error', 'pending'], default: 'pending' },
    errorMessage: { type: String },
    listingUrl: { type: String },
  },
  { _id: false }
);

const ListingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, index: true },
    condition: { type: String, default: 'Used - Good' },
    brand: { type: String, default: '' },
    location: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Pending', 'Sold', 'Draft'], default: 'Active' },
    images: [ImageSchema],
    // Posting channels
    postedFacebookMarketplace: { type: Boolean, default: false },
    postedKijijiCanada: { type: Boolean, default: false },
    // Sold flags
    soldFacebookMarketplace: { type: Boolean, default: false },
    soldKijijiCanada: { type: Boolean, default: false },
    // Analytics data
    analytics: {
      facebook: AnalyticsSchema,
      kijiji: AnalyticsSchema,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Listing', ListingSchema);

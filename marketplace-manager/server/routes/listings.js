const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Listing = require('../models/Listing');
const auth = require('../middleware/auth');

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage });

const router = express.Router();

// GET /api/listings - list user's listings
router.get('/', auth, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json(listings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load listings' });
  }
});

// POST /api/listings - create a listing
router.post('/', auth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, description, price, category, condition, brand, location, status } = req.body;
    const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
    const postedFacebookMarketplace = toBool(req.body.postedFacebookMarketplace);
    const postedKijijiCanada = toBool(req.body.postedKijijiCanada);
    const soldFacebookMarketplace = toBool(req.body.soldFacebookMarketplace);
    const soldKijijiCanada = toBool(req.body.soldKijijiCanada);
    if (!title || !price) return res.status(400).json({ message: 'Title and price are required' });

    const images = (req.files || []).map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype,
    }));

    const listing = await Listing.create({
      user: req.user.id,
      title,
      description,
      price,
      category,
      condition,
      brand,
      location,
      status,
      images,
      postedFacebookMarketplace,
      postedKijijiCanada,
      soldFacebookMarketplace,
      soldKijijiCanada,
    });

    return res.status(201).json(listing);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to create listing' });
  }
});

// GET /api/listings/:id - get a listing (must belong to user)
router.get('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    return res.json(listing);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load listing' });
  }
});

// PUT /api/listings/:id - update listing
router.put('/:id', auth, upload.array('images', 10), async (req, res) => {
  try {
    const update = { ...req.body };
    const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
    if (Object.prototype.hasOwnProperty.call(req.body, 'postedFacebookMarketplace')) {
      update.postedFacebookMarketplace = toBool(req.body.postedFacebookMarketplace);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'postedKijijiCanada')) {
      update.postedKijijiCanada = toBool(req.body.postedKijijiCanada);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'soldFacebookMarketplace')) {
      update.soldFacebookMarketplace = toBool(req.body.soldFacebookMarketplace);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'soldKijijiCanada')) {
      update.soldKijijiCanada = toBool(req.body.soldKijijiCanada);
    }
    // If new files uploaded, append to images
    if (req.files?.length) {
      const images = req.files.map((f) => ({
        url: `/uploads/${f.filename}`,
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
      }));
      update.$push = { images: { $each: images } };
    }

    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      update,
      { new: true }
    );

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    return res.json(listing);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update listing' });
  }
});

// DELETE /api/listings/:id - delete listing
router.delete('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to delete listing' });
  }
});

// POST /api/listings/:id/scrape - scrape analytics for a listing
router.post('/:id/scrape', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    console.log(`Starting scrape for listing: ${listing._id}`);

    const scrapingService = require('../services/scrapingService');

    // Extract Facebook credentials and cookies from request body
    const { facebookCredentials, facebookCookies } = req.body;
    const credentials = facebookCredentials ? {
      email: facebookCredentials.email,
      password: facebookCredentials.password
    } : null;

    // Pass credentials and cookies to scraping service
    const results = await scrapingService.scrapeListings([listing], credentials, facebookCookies || null);

    console.log(`Scraping results:`, JSON.stringify(results, null, 2));

    if (results.length > 0 && results[0].analytics) {
      // Update the listing with new analytics data
      if (results[0].analytics.facebook) {
        console.log(`Updating Facebook analytics:`, results[0].analytics.facebook);
        listing.analytics.facebook = { ...listing.analytics.facebook, ...results[0].analytics.facebook };
      }
      if (results[0].analytics.kijiji) {
        console.log(`Updating Kijiji analytics:`, results[0].analytics.kijiji);
        listing.analytics.kijiji = { ...listing.analytics.kijiji, ...results[0].analytics.kijiji };
      }

      console.log(`Saving listing with updated analytics...`);
      await listing.save();
      console.log(`Listing saved successfully!`);
    } else {
      console.log(`No analytics results to update`);
    }

    return res.json({
      success: true,
      analytics: {
        facebook: results[0].analytics?.facebook ? { ...listing.analytics.facebook, ...results[0].analytics.facebook } : listing.analytics.facebook || {},
        kijiji: results[0].analytics?.kijiji ? { ...listing.analytics.kijiji, ...results[0].analytics.kijiji } : listing.analytics.kijiji || {}
      },
      results: results[0]
    });
  } catch (err) {
    console.error('Scraping error:', err);
    return res.status(500).json({ message: 'Failed to scrape analytics', error: err.message });
  }
});

// PUT /api/listings/:id/analytics-urls - update analytics URLs for scraping
router.put('/:id/analytics-urls', auth, async (req, res) => {
  try {
    const { facebookUrl, kijijiUrl } = req.body;

    const listing = await Listing.findOne({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    // Initialize analytics if not exists
    if (!listing.analytics) {
      listing.analytics = { facebook: {}, kijiji: {} };
    }

    if (facebookUrl) {
      listing.analytics.facebook = {
        ...listing.analytics.facebook,
        listingUrl: facebookUrl,
        scrapeStatus: 'pending'
      };
    }

    if (kijijiUrl) {
      listing.analytics.kijiji = {
        ...listing.analytics.kijiji,
        listingUrl: kijijiUrl,
        scrapeStatus: 'pending'
      };
    }

    await listing.save();

    return res.json({
      success: true,
      analytics: listing.analytics
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update analytics URLs' });
  }
});

// GET /api/listings/:id/analytics - get analytics data for a listing
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    return res.json({
      analytics: listing.analytics || { facebook: {}, kijiji: {} }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to get analytics' });
  }
});

// PUT /api/listings/:id/analytics-manual - manually update selected analytics fields
router.put('/:id/analytics-manual', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, user: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const { facebookClicks, kijijiViews } = req.body || {};

    // Initialize analytics object if needed
    if (!listing.analytics) listing.analytics = { facebook: {}, kijiji: {} };
    if (!listing.analytics.facebook) listing.analytics.facebook = {};
    if (!listing.analytics.kijiji) listing.analytics.kijiji = {};

    if (facebookClicks !== undefined) {
      const n = Number(facebookClicks);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ message: 'facebookClicks must be a non-negative number' });
      }
      listing.analytics.facebook.clicks = Math.floor(n);
      listing.analytics.facebook.scrapeStatus = listing.analytics.facebook.scrapeStatus || 'success';
      listing.analytics.facebook.lastScraped = new Date();
    }

    if (kijijiViews !== undefined) {
      const n = Number(kijijiViews);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ message: 'kijijiViews must be a non-negative number' });
      }
      listing.analytics.kijiji.views = Math.floor(n);
      listing.analytics.kijiji.scrapeStatus = listing.analytics.kijiji.scrapeStatus || 'success';
      listing.analytics.kijiji.lastScraped = new Date();
    }

    await listing.save();

    return res.json({
      success: true,
      analytics: listing.analytics,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update analytics manually' });
  }
});

// POST /api/listings/scrape-all - scrape analytics for all listings (admin/debug endpoint)
router.post('/scrape-all', auth, async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    const results = await schedulerService.scrapeAllListings();

    return res.json({
      success: true,
      message: 'Manual scraping completed',
      results
    });
  } catch (err) {
    console.error('Scrape all error:', err);
    return res.status(500).json({ message: 'Failed to scrape all listings', error: err.message });
  }
});

module.exports = router;

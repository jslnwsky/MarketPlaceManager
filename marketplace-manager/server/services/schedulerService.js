const scrapingService = require('./scrapingService');

class SchedulerService {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  // Start periodic scraping for all listings with configured URLs
  startPeriodicScraping(intervalMinutes = 60) {
    if (this.isRunning) {
      console.log('Periodic scraping already running');
      return;
    }

    console.log(`Starting periodic scraping every ${intervalMinutes} minutes`);
    this.isRunning = true;

    const intervalId = setInterval(async () => {
      await this.scrapeAllListings();
    }, intervalMinutes * 60 * 1000);

    this.intervals.set('periodic', intervalId);

    // Run initial scrape
    this.scrapeAllListings();
  }

  // Stop all periodic scraping
  stopPeriodicScraping() {
    this.isRunning = false;

    for (const [name, intervalId] of this.intervals) {
      clearInterval(intervalId);
    }

    this.intervals.clear();
    console.log('Periodic scraping stopped');
  }

  // Scrape analytics for all listings that have configured URLs
  async scrapeAllListings() {
    try {
      console.log('Starting scheduled scraping of all listings...');

      const Listing = require('../models/Listing');

      // Find all listings with analytics URLs configured
      const listings = await Listing.find({
        $or: [
          { 'analytics.facebook.listingUrl': { $exists: true, $ne: '' } },
          { 'analytics.kijiji.listingUrl': { $exists: true, $ne: '' } }
        ]
      });

      if (listings.length === 0) {
        console.log('No listings found with configured analytics URLs');
        return;
      }

      console.log(`Found ${listings.length} listings to scrape`);

      const results = await scrapingService.scrapeListings(listings);
      let successCount = 0;
      let errorCount = 0;

      // Update database with results
      for (const result of results) {
        if (result.error) {
          errorCount++;
          console.error(`Error scraping listing ${result.listingId}:`, result.error);
          continue;
        }

        try {
          const listing = await Listing.findById(result.listingId);
          if (listing && result.analytics) {
            if (result.analytics.facebook) {
              listing.analytics.facebook = {
                ...listing.analytics.facebook,
                ...result.analytics.facebook
              };
            }
            if (result.analytics.kijiji) {
              listing.analytics.kijiji = {
                ...listing.analytics.kijiji,
                ...result.analytics.kijiji
              };
            }
            await listing.save();
            successCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error updating listing ${result.listingId}:`, error);
        }
      }

      console.log(`Scheduled scraping completed: ${successCount} successful, ${errorCount} errors`);

    } catch (error) {
      console.error('Error in scheduled scraping:', error);
    }
  }

  // Scrape a specific listing by ID
  async scrapeListingById(listingId) {
    try {
      const Listing = require('../models/Listing');
      const listing = await Listing.findById(listingId);

      if (!listing) {
        throw new Error('Listing not found');
      }

      const results = await scrapingService.scrapeListings([listing]);

      if (results.length > 0 && results[0].analytics) {
        if (results[0].analytics.facebook) {
          listing.analytics.facebook = {
            ...listing.analytics.facebook,
            ...results[0].analytics.facebook
          };
        }
        if (results[0].analytics.kijiji) {
          listing.analytics.kijiji = {
            ...listing.analytics.kijiji,
            ...results[0].analytics.kijiji
          };
        }
        await listing.save();
      }

      return results[0];
    } catch (error) {
      console.error('Error scraping listing by ID:', error);
      throw error;
    }
  }

  // Get scraping status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeIntervals: Array.from(this.intervals.keys())
    };
  }
}

module.exports = new SchedulerService();

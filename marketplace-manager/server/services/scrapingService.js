const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class ScrapingService {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      const headful = String(process.env.PUPPETEER_HEADFUL || '').toLowerCase() === 'true';
      let userDataDir = process.env.PUPPETEER_USER_DATA_DIR || '';
      const launchOptions = {
        headless: !headful,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
      if (headful) {
        // Larger window helps some FB elements render consistently
        launchOptions.args.push('--window-size=1600,1000');
      }
      if (userDataDir) {
        // Resolve relative paths robustly to avoid duplicated segments like server/marketplace-manager/server
        if (!path.isAbsolute(userDataDir)) {
          const serverRoot = path.resolve(__dirname, '..'); // .../marketplace-manager/server
          const projectRoot = path.resolve(serverRoot, '..'); // .../marketplace-manager
          if (userDataDir.startsWith('marketplace-manager/')) {
            userDataDir = path.resolve(projectRoot, userDataDir);
          } else {
            userDataDir = path.resolve(serverRoot, userDataDir);
          }
        }
        // Ensure directory exists and clear stale SingletonLock
        try { fs.mkdirSync(userDataDir, { recursive: true }); } catch {}
        try { fs.rmSync(path.join(userDataDir, 'SingletonLock'), { force: true }); } catch {}
        console.log('[Puppeteer] Using userDataDir:', userDataDir);
        launchOptions.userDataDir = userDataDir;
      }
      this.browser = await puppeteer.launch(launchOptions);
    }
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Apply Facebook cookies exported from a browser extension
  async applyFacebookCookies(page, cookies) {
    if (!Array.isArray(cookies) || cookies.length === 0) return;
    console.log(`Applying ${cookies.length} Facebook cookies to the page...`);

    // Map extension-exported cookie fields to Puppeteer's expected format
    const mapped = cookies.map((c) => {
      const mappedCookie = {
        name: c.name,
        value: c.value,
        domain: c.domain || '.facebook.com',
        path: c.path || '/',
        httpOnly: Boolean(c.httpOnly),
        secure: c.secure !== false,
      };
      // expirationDate may be float seconds; Puppeteer accepts 'expires' in seconds since epoch
      if (typeof c.expirationDate === 'number') {
        mappedCookie.expires = Math.floor(c.expirationDate);
      }
      // Map sameSite values
      if (c.sameSite) {
        const s = String(c.sameSite).toLowerCase();
        if (s.includes('no') || s.includes('none')) mappedCookie.sameSite = 'None';
        else if (s.includes('lax')) mappedCookie.sameSite = 'Lax';
        else if (s.includes('strict')) mappedCookie.sameSite = 'Strict';
      }
      return mappedCookie;
    });

    // Must be on the target domain before setting cookies
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    for (const ck of mapped) {
      try {
        await page.setCookie(ck);
      } catch (e) {
        console.warn(`Failed to set cookie ${ck.name}: ${e.message}`);
      }
    }
    console.log('Facebook cookies applied.');
  }

  async loginToFacebook(page, credentials) {
    try {
      console.log('🚀 Starting enhanced Facebook authentication...');

      // Enhanced browser fingerprinting to avoid detection
      await page.evaluateOnNewDocument(() => {
        // Override navigator properties to appear more like a real browser
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
          ]
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });

        // Remove automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
      });

      // Set more realistic viewport and user agent
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Set realistic user agent with slight randomization
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUserAgent);

      // Set additional headers to appear more legitimate
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      console.log('🌐 Navigating to Facebook login page...');

      // Navigate with longer timeout and wait conditions
      await page.goto('https://www.facebook.com/login', {
        waitUntil: 'networkidle2',
        timeout: 90000
      });

      // Wait for page to fully load and stabilize
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

      console.log('📍 Facebook login page loaded, looking for form elements...');

      // More comprehensive element detection
      const emailSelectors = [
        'input[name="email"]',
        'input[name="username"]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[id*="email" i]',
        '#email',
        'input[autocomplete="username"]'
      ];

      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          emailInput = await page.$(selector);
          if (emailInput) {
            console.log(`✅ Found email input: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!emailInput) {
        throw new Error('Could not locate email input field on Facebook login page');
      }

      // Human-like typing with random delays
      console.log('📝 Entering email with human-like typing...');
      const emailChunks = credentials.email.split('');
      for (let i = 0; i < emailChunks.length; i++) {
        await emailInput.type(emailChunks[i]);
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      }

      // Small pause before password
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      // Find password input
      const passwordSelectors = [
        'input[name="pass"]',
        'input[type="password"]',
        'input[placeholder*="password" i]',
        'input[id*="password" i]',
        'input[id*="pass" i]',
        '#pass',
        'input[autocomplete="current-password"]'
      ];

      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          passwordInput = await page.$(selector);
          if (passwordInput) {
            console.log(`✅ Found password input: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!passwordInput) {
        throw new Error('Could not locate password input field on Facebook login page');
      }

      // Human-like password typing
      console.log('🔐 Entering password with human-like typing...');
      const passwordChunks = credentials.password.split('');
      for (let i = 0; i < passwordChunks.length; i++) {
        await passwordInput.type(passwordChunks[i]);
        await new Promise(resolve => setTimeout(resolve, 70 + Math.random() * 150));
      }

      // Wait before clicking login button
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Find and click login button
      const loginSelectors = [
        'button[name="login"]',
        'button[type="submit"]',
        'input[type="submit"]',
        'button[data-testid="royal_login_button"]',
        'button[data-visualcompletion="ignore-dynamic"]',
        'button[id*="login"]'
      ];

      let loginButton = null;
      for (const selector of loginSelectors) {
        try {
          loginButton = await page.$(selector);
          if (loginButton) {
            const isVisible = await loginButton.isIntersectingViewport();
            if (isVisible) {
              console.log(`✅ Found login button: ${selector}`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!loginButton) {
        throw new Error('Could not locate login button on Facebook login page');
      }

      console.log('🔥 Clicking login button...');

      // Click login and wait for navigation
      await Promise.all([
        loginButton.click(),
        page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: 60000
        }).catch(() => {}) // Ignore navigation timeout
      ]);

      // Wait for potential redirects or page loads
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

      console.log('🔍 Checking login result...');

      // Check for various error conditions
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Check for login errors
      const errorSelectors = [
        '[role="alert"]',
        '.error',
        '[data-visualcompletion="ignore-dynamic"]',
        '.login_error_box',
        '[data-testid="login_error"]'
      ];

      for (const selector of errorSelectors) {
        try {
          const errorEl = await page.$(selector);
          if (errorEl) {
            const errorText = await errorEl.evaluate(el => el.textContent || '');
            if (errorText && (errorText.toLowerCase().includes('error') ||
                             errorText.toLowerCase().includes('incorrect') ||
                             errorText.toLowerCase().includes('wrong'))) {
              throw new Error(`Facebook login error: ${errorText}`);
            }
          }
        } catch (e) {
          // Continue checking
        }
      }

      // Check if still on login page or checkpoint
      if (currentUrl.includes('/login') || currentUrl.includes('checkpoint')) {
        throw new Error('Login failed - still on login page or encountered security checkpoint');
      }

      // Check for successful login indicators
      const successSelectors = [
        '[data-visualcompletion="ignore-dynamic"]',
        'a[href*="/logout"]',
        '[aria-label*="menu"]',
        '.fb-logo',
        'div[role="banner"]',
        'div[data-pagelet="Feed"]',
        'div[data-pagelet="Profile"]'
      ];

      let loginSuccessful = false;
      for (const selector of successSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            console.log(`✅ Found login success indicator: ${selector}`);
            loginSuccessful = true;
            break;
          }
        } catch (e) {
          // Continue checking
        }
      }

      if (loginSuccessful) {
        console.log('🎉 Facebook login successful!');
        // Wait for any post-login redirects
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      } else {
        // Take screenshot for debugging
        try {
          await page.screenshot({
            path: `facebook_login_debug_${Date.now()}.png`,
            fullPage: true
          });
          console.log('📸 Screenshot saved for debugging');
        } catch (screenshotError) {
          console.log('⚠️ Could not save screenshot');
        }

        throw new Error('Could not verify successful login - no success indicators found');
      }

    } catch (error) {
      console.error('❌ Enhanced Facebook login failed:', error.message);

      // Take error screenshot
      try {
        await page.screenshot({
          path: `facebook_login_error_${Date.now()}.png`,
          fullPage: true
        });
        console.log('📸 Error screenshot saved');
      } catch (screenshotError) {
        console.log('⚠️ Could not save error screenshot');
      }

      throw new Error(`Enhanced Facebook authentication failed: ${error.message}`);
    }
  }

  async navigateToMarketplaceSelling(page) {
    // Ensure we land on Marketplace and then Selling tab
    try {
      await page.goto('https://www.facebook.com/marketplace/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch {}
    // If not on marketplace, try clicking the Marketplace icon/link
    const href = page.url();
    if (!href.includes('/marketplace')) {
      try {
        const marketplaceLink = await page.$('a[aria-label*="Marketplace" i], a[href*="/marketplace"]');
        if (marketplaceLink) await marketplaceLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      } catch {}
    }
    // Go directly to Selling tab
    try {
      await page.goto('https://www.facebook.com/marketplace/you/selling', { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));
    } catch {}
  }

  async scrapeFacebookSellingDashboard(page, listingTitle) {
    // Scrape metrics from the Selling dashboard by matching the listing card by title
    const titleNeedle = (listingTitle || '').trim().toLowerCase();
    if (!titleNeedle) throw new Error('Missing listing title for Selling dashboard scraping');

    // Wait for selling container
    try { await page.waitForSelector('[role="main"], [data-pagelet]', { timeout: 15000 }); } catch {}
    // Incremental scroll to load more cards
    try {
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        let lastH = 0;
        for (let i = 0; i < 8; i++) {
          window.scrollBy(0, window.innerHeight * 0.9);
          await sleep(400 + Math.random()*200);
          const h = document.body.scrollHeight;
          if (h === lastH) break;
          lastH = h;
        }
        window.scrollTo(0, 0);
      });
    } catch {}

    const data = await page.evaluate((needle) => {
      function normalizeTitle(t) {
        return String(t || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^a-z0-9 $\.]/g, '')
          .replace(/notifications?|unread|turn on notifications|marketplace/i, '')
          .trim();
      }

      function parseNumberLike(text) {
        if (!text) return 0;
        const m = String(text).match(/(\d+(?:,\d+)*(?:\.\d+)?)(\s*[KkMm])?/);
        if (!m) return 0;
        let n = parseFloat(m[1].replace(/,/g, ''));
        if (m[2]) {
          const s = m[2].trim().toLowerCase();
          if (s === 'k') n = n * 1000;
          if (s === 'm') n = n * 1000000;
        }
        return Math.floor(n || 0);
      }

      // Prefer real listing cards anchored by /marketplace/item links
      const itemAnchors = Array.from(document.querySelectorAll('a[href*="/marketplace/item"]'));
      const cardSet = new Set();
      for (const a of itemAnchors) {
        let el = a;
        for (let i = 0; i < 6 && el && el.parentElement; i++) {
          el = el.parentElement;
          if (!el) break;
          const role = el.getAttribute('role') || '';
          // Treat article or listitem containers as cards
          if (role === 'article' || role === 'listitem' || el.querySelector('a[href*="/marketplace/item"]')) {
            cardSet.add(el);
            break;
          }
        }
      }
      // Fallback to action-button cards if none found
      if (cardSet.size === 0) {
        const actionButtons = Array.from(document.querySelectorAll('button'))
          .filter(b => /mark as sold|mark as available|boost listing|share/i.test(b.textContent || ''));
        for (const btn of actionButtons) {
          let el = btn;
          for (let i = 0; i < 6 && el && el.parentElement; i++) {
            el = el.parentElement;
            if (el.getAttribute('role') === 'article' || el.querySelector('button')) {
              cardSet.add(el);
            }
          }
        }
      }
      const cards = Array.from(cardSet);

      // Try to find the card whose title matches our needle
      function extractTitleFromCard(card) {
        // Try common title locations
        const titleCandidates = [];
        titleCandidates.push(card.querySelector('a[role="link"]'));
        titleCandidates.push(card.querySelector('span'));
        titleCandidates.push(card.querySelector('h2, h3'));
        // Include all strong/bold text nodes
        card.querySelectorAll('strong, b').forEach(x => titleCandidates.push(x));
        const texts = titleCandidates
          .filter(Boolean)
          .map(el => (el.textContent || '').trim())
          .filter(t => t && t.length >= 3);
        if (texts.length === 0) return '';
        // Pick the longest meaningful text as title
        return texts.sort((a, b) => b.length - a.length)[0];
      }

      const normNeedle = normalizeTitle(needle);
      let matchedCard = null;
      let matchedTitleRaw = '';
      for (const card of cards) {
        const raw = extractTitleFromCard(card);
        const title = normalizeTitle(raw);
        if (!title) continue;
        // Require substantial overlap to avoid matching unrelated notifications
        if (title.includes(normNeedle) || normNeedle.includes(title)) {
          matchedCard = card;
          matchedTitleRaw = raw || '';
          break;
        }
      }

      // Fallback: scan all large blocks for the needle
      if (!matchedCard) {
        const blocks = Array.from(document.querySelectorAll('div, article, li'));
        for (const block of blocks) {
          const t = normalizeTitle(block.textContent || '');
          if (t.includes(normNeedle)) { matchedCard = block; matchedTitleRaw = (block.textContent || '').trim().slice(0, 120); break; }
        }
      }

      if (!matchedCard) return null;

      // Extract metrics explicitly from matched card only
      // Re-read text to reduce stale content risk after virtual list updates
      const cardText = (matchedCard.textContent || '');
      // Example: "197 clicks on listing"
      let clicks = 0, views = 0, favorites = 0;

      // Clicks pattern (take the maximum among all matches, tolerate optional '+')
      const clicksMatches = cardText.matchAll(/(\d[\d,\.]*)\+?\s+clicks?\s+on\s+listing/gi);
      for (const m of clicksMatches) {
        const v = parseNumberLike(m[1]);
        if (v > clicks) clicks = v;
      }

      // Views pattern (if Facebook surfaces it)
      const viewsMatch = cardText.match(/(\d[\d,\.]*)\s+views?/i);
      if (viewsMatch) views = parseNumberLike(viewsMatch[1]);

      // Favorites / saves pattern
      const favMatch = cardText.match(/(\d[\d,\.]*)\s+(saves?|favorites?)/i);
      if (favMatch) favorites = parseNumberLike(favMatch[1]);

      if (views || clicks || favorites) {
        return { views, clicks, favorites, shares: 0, matchedTitle: matchedTitleRaw };
      }
      return null;
    }, titleNeedle);

    if (!data) throw new Error('Could not locate metrics for listing on Selling dashboard');
    return data;
  }

  async scrapeFacebookListing(url, credentials = null, cookies = null, listingTitle = '') {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await this.init();
        const page = await browser.newPage();

        // Set user agent and viewport to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        // Prefer cookie-based auth if provided; else fall back to credentials
        if (cookies && Array.isArray(cookies) && cookies.length) {
          console.log('Using provided Facebook cookies for authentication...');
          await this.applyFacebookCookies(page, cookies);
        } else if (credentials && credentials.email && credentials.password) {
          console.log('Authenticating with Facebook using credentials...');
          await this.loginToFacebook(page, credentials);
        }

        console.log(`[Facebook] Attempt ${attempt}: navigating to`, url, 'with title:', listingTitle);
        // Navigate to the listing with timeout
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(r => setTimeout(r, 1000 + Math.random()*500));

        // Landed URL for Facebook
        const href = page.url();
        console.log('[Facebook] Landed on URL:', href);

        // Wait for content to load and add some random delay
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Check if we were redirected to login or checkpoint
        const currentUrl = page.url();
        console.log(`Facebook navigate URL: ${currentUrl}`);
        if (currentUrl.includes('/login') || currentUrl.includes('checkpoint')) {
          const shot = `facebook_nav_error_${Date.now()}.png`;
          try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
          await page.close();
          throw new Error(`Not authenticated (redirected to ${currentUrl.includes('checkpoint') ? 'checkpoint' : 'login'}). Screenshot: ${shot}`);
        }

        // If user provided the Selling dashboard, scrape metrics from there by title
        if (currentUrl.includes('/marketplace/you/selling')) {
          try {
            const metrics = await this.scrapeFacebookSellingDashboard(page, listingTitle);
            await page.close();
            if (metrics?.matchedTitle) {
              console.log(`Matched Selling card title: ${metrics.matchedTitle}`);
            }
            return {
              ...metrics,
              scrapeStatus: 'success',
              lastScraped: new Date(),
              listingUrl: currentUrl
            };
          } catch (dashErr) {
            console.log('[Facebook] Dashboard scrape failed, trying to open matched item:', dashErr.message);
            // Fallback: try to click into the specific item and scrape detail page
            try {
              const itemHref = await page.evaluate((needle) => {
                function norm(t){return String(t||'').toLowerCase().replace(/\s+/g,' ').trim();}
                const nNeedle = norm(needle);
                const anchors = Array.from(document.querySelectorAll('a[href*="/marketplace/item"]'));
                for (const a of anchors) {
                  let el = a;
                  for (let i=0;i<6 && el && el.parentElement;i++){
                    el = el.parentElement;
                    const title = (el.textContent||'').trim();
                    if (title && norm(title).includes(nNeedle)) return a.href;
                  }
                }
                return null;
              }, listingTitle);
              if (!itemHref) throw new Error('Could not find item link for the specified title');
              await page.goto(itemHref, { waitUntil: 'networkidle2', timeout: 60000 }).catch(()=>{});
              await new Promise(r=>setTimeout(r,1500));
              const detailMetrics = await page.evaluate(() => {
                const txt = document.body.innerText || '';
                function parseN(s){const m=String(s).match(/(\d[\d,\.]*)/);return m?parseInt(m[1].replace(/,/g,''),10):0;}
                let clicks = 0, views = 0, favorites = 0;
                // clicks on listing
                const cm = txt.match(/(\d[\d,\.]*)\+?\s+clicks?\s+on\s+listing/i); if (cm) clicks = parseN(cm[1]);
                // views
                const vm = txt.match(/(\d[\d,\.]*)\s+views?/i); if (vm) views = parseN(vm[1]);
                // favorites / saves
                const fm = txt.match(/(\d[\d,\.]*)\s+(saves?|favorites?)/i); if (fm) favorites = parseN(fm[1]);
                return { clicks, views, favorites };
              });
              const finalUrl = page.url();
              await page.close();
              return { ...detailMetrics, shares: 0, scrapeStatus: 'success', lastScraped: new Date(), listingUrl: finalUrl };
            } catch (fallbackErr) {
              await page.close();
              throw new Error(`Dashboard fallback failed: ${fallbackErr.message}`);
            }
          }
        }

        // (Facebook-only) No Kijiji dashboard handling here

        // Extract analytics data for listing detail pages
        const analytics = await page.evaluate(() => {
          const result = { views: 0, clicks: 0, favorites: 0, shares: 0, scrapeStatus: 'success' };
          try {
            const bodyText = document.body.innerText || '';
            function parseN(s){const m=String(s).match(/(\d[\d,\.]*)/);return m?parseInt(m[1].replace(/,/g,''),10):0;}
            // clicks on listing
            const cm = bodyText.match(/(\d[\d,\.]*)\+?\s+clicks?\s+on\s+listing/i); if (cm) result.clicks = parseN(cm[1]);
            // views
            const vm = bodyText.match(/(\d[\d,\.]*)\s+views?/i); if (vm) result.views = parseN(vm[1]);
            // favorites / saves
            const fm = bodyText.match(/(\d[\d,\.]*)\s+(saves?|favorites?)/i); if (fm) result.favorites = parseN(fm[1]);
          } catch (error) {
            result.scrapeStatus = 'error';
            result.errorMessage = error.message;
          }
          return result;
        });

        await page.close();

        // Only mark success if we actually detected metrics
        if ((analytics.views > 0) || (analytics.clicks > 0) || (analytics.favorites > 0) || (analytics.shares > 0)) {
          return {
            ...analytics,
            lastScraped: new Date(),
            listingUrl: url
          };
        }

        // If no data found, continue to retry with clearer message and screenshot
        const noDataShot = `facebook_no_data_${Date.now()}.png`;
        try {
          // Re-open new page briefly to capture the state can be expensive; instead reuse last URL isn't possible now.
          // We already closed the page; skip screenshot here to avoid extra navigation cost.
        } catch {}
        throw new Error('No analytics data found on page (selectors did not match)');

      } catch (error) {
        lastError = error;
        console.log(`Facebook scraping attempt ${attempt} failed:`, error.message);
        try {
          const errShot = path.join(process.cwd(), `facebook_scrape_attempt_${attempt}_${Date.now()}.png`);
          const b = await this.init();
          const p = await b.newPage();
          await p.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await p.screenshot({ path: errShot }).catch(() => {});
          await p.close();
          console.log(`Saved diagnostic screenshot: ${errShot}`);
        } catch {}

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    return {
      views: 0,
      clicks: 0,
      favorites: 0,
      shares: 0,
      scrapeStatus: 'error',
      errorMessage: lastError?.message || 'Max retries exceeded',
      lastScraped: new Date(),
      listingUrl: url
    };
  }

  async scrapeKijijiDashboard(page, listingTitle) {
    const titleNeedle = (listingTitle || '').trim().toLowerCase();
    if (!titleNeedle) throw new Error('Missing listing title for Kijiji dashboard scraping');

    // Wait for dashboard to render (look for Views header or action buttons)
    try { await page.waitForFunction(() => /views/i.test(document.body.innerText || ''), { timeout: 15000 }); } catch {}

    const data = await page.evaluate((needle) => {
      function normalize(t){return String(t||'').toLowerCase().replace(/\s+/g,' ').trim();}
      function parseNum(t){if(!t)return 0;const m=String(t).match(/\d[\d,\.]*/);return m?parseInt(m[0].replace(/,/g,''),10):0;}

      function extractTitleFromNode(node){
        const cands = [];
        cands.push(node.querySelector('a[title]'));
        cands.push(node.querySelector('a[href*="/v-"]'));
        cands.push(node.querySelector('h2, h3'));
        cands.push(node.querySelector('[data-qa*="title" i]'));
        cands.push(node.querySelector('a'));
        const texts = cands.filter(Boolean).map(n=> (n.textContent||'').trim()).filter(Boolean);
        if (texts.length===0) return '';
        return texts.sort((a,b)=>b.length-a.length)[0];
      }

      // Prefer obvious my-ads containers
      const containers = Array.from(document.querySelectorAll('[data-qa*="my" i], [data-qa*="ads" i], tr, li, article, div'));
      let matched = null; let matchedTitle = '';
      for (const row of containers) {
        const rawTitle = extractTitleFromNode(row);
        const nTitle = normalize(rawTitle);
        if (!nTitle) continue;
        if (nTitle.includes(normalize(needle))) {
          const txt = normalize(row.textContent||'');
          if (/edit\s*ad/i.test(txt) || /delete/i.test(txt) || /promote/i.test(txt) || /views/i.test(txt)) {
            matched = row; matchedTitle = rawTitle; break;
          }
        }
      }
      if (!matched) return null;

      // Attempt to locate the Views cell near a Views header or numeric cell in same row
      const row = matched.closest('tr') || matched;
      let views = 0;
      if (row.tagName === 'TR') {
        const headers = Array.from(row.closest('table')?.querySelectorAll('thead th')||[]).map(th=>normalize(th.textContent||''));
        const viewsIdx = headers.findIndex(h=>/views/.test(h));
        if (viewsIdx >= 0) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells[viewsIdx]) views = parseNum(cells[viewsIdx].textContent||'');
        }
      }
      if (!views) {
        // Heuristic for card layout:
        // - Extract numeric tokens with their x positions
        // - Exclude currency ($) and date-like tokens near month names
        // - Choose the second-rightmost small number as Views (rightmost is often Messages)
        const monthRx = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
        const tokens = [];
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT, null);
        while (walker.nextNode()) {
          const el = walker.currentNode;
          const text = (el.textContent||'').trim();
          if (!text) continue;
          const mAll = text.matchAll(/\$?\b(\d[\d,\.]*)\b/g);
          for (const m of mAll) {
            const raw = m[0];
            const num = parseNum(m[1]);
            if (!num) continue;
            // Exclude currency
            if (raw.trim().startsWith('$')) continue;
            // Exclude date-like tokens if month nearby
            const ctx = text.toLowerCase();
            if (monthRx.test(ctx)) continue;
            const rect = el.getBoundingClientRect();
            tokens.push({ num, x: rect.right });
          }
        }
        tokens.sort((a,b)=>a.x-b.x); // left -> right
        if (tokens.length >= 2) {
          views = tokens[tokens.length-2].num; // second-rightmost
        } else if (tokens.length === 1) {
          views = tokens[0].num;
        }
      }

      return { views, clicks: 0, favorites: 0, shares: 0, matchedTitle };
    }, titleNeedle);

    if (!data) throw new Error('Could not locate listing on Kijiji dashboard');
    return data;
  }

  async scrapeKijijiListing(url, credentials = null, listingTitle = '') {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await this.init();
        const page = await browser.newPage();

        // Set user agent and viewport to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        console.log(`[Kijiji] Attempt ${attempt}: navigating to`, url, 'with title:', listingTitle);
        // Navigate to the listing with timeout
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for content to load and add some random delay
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Detect login redirect on Kijiji
        const landed = page.url();
        console.log('[Kijiji] Landed on URL:', landed);
        if (/login|signin|t-login/i.test(landed) || await page.$('input[type="password"]')) {
          const shot = path.join(__dirname, '..', '.diagnostics', `kijiji_login_${Date.now()}.png`);
          try { fs.mkdirSync(path.dirname(shot), { recursive: true }); } catch {}
          try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
          throw new Error(`Kijiji not authenticated (redirected to login). Screenshot: ${shot}`);
        }

        // If we requested My Ads but got bounced elsewhere (e.g., home), treat as not authenticated
        if (/\/m-(?:my|m)-ads\//.test(url) && !/\/m-(?:my|m)-ads\//.test(landed)) {
          const shot = path.join(__dirname, '..', '.diagnostics', `kijiji_bounce_${Date.now()}.png`);
          try { fs.mkdirSync(path.dirname(shot), { recursive: true }); } catch {}
          try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
          throw new Error(`Kijiji likely not authenticated (bounced to ${landed}). Screenshot: ${shot}`);
        }

        // If dashboard URL, paginate up to 5 pages to find the ad by title
        const current = page.url();
        if (/(\/m-(?:my|m)-ads\/active)(?:\/|$)/.test(current) || /(\/m-(?:my|m)-ads\/)/.test(current)) {
          console.log(`Kijiji dashboard detected. Searching pages for title: ${listingTitle}`);
          console.log('Current URL:', current);
          const m = current.match(/^(.*?\/m-(?:my|m)-ads\/active)(?:\/(\d+))?(?:\?.*)?$/);
          let base = m && m[1] ? m[1] : current.replace(/\/(\d+)(?:\?.*)?$/, '');
          for (let p = 1; p <= 5; p++) {
            const target = `${base}/${p}`;
            if (page.url() !== target) {
              try {
                await page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(r=>setTimeout(r, 800));
              } catch {}
            }
            try {
              const metrics = await this.scrapeKijijiDashboard(page, listingTitle);
              if (metrics && (metrics.views || metrics.favorites || metrics.clicks || metrics.matchedTitle)) {
                console.log(`Matched Kijiji ad title: ${metrics.matchedTitle || '(unknown)'} on page ${p}`);
                await page.close();
                return { ...metrics, scrapeStatus: 'success', lastScraped: new Date(), listingUrl: page.url() };
              }
            } catch (e) {
              console.log(`No match on Kijiji dashboard page ${p}: ${e.message || e}`);
              // continue to next page
            }
          }
          // Not found across pages; capture screenshot for diagnostics
          console.log('Kijiji dashboard search exhausted pages 1-5 without a match');
          const shot = path.join(__dirname, '..', '.diagnostics', `kijiji_not_found_${Date.now()}.png`);
          try { fs.mkdirSync(path.dirname(shot), { recursive: true }); } catch {}
          try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
          throw new Error(`Could not locate listing by title on Kijiji active ads pages (1-5). Screenshot: ${shot}`);
        }

        // Extract analytics data
        const analytics = await page.evaluate(() => {
          const result = {
            views: 0,
            clicks: 0,
            favorites: 0,
            shares: 0,
            scrapeStatus: 'success'
          };

          try {
            // Look for view counts on Kijiji
            const viewSelectors = [
              '.view-count',
              '.views',
              '[data-qa="view-count"]',
              '.listing-stats .views',
              '.engagement .views',
              '.stats .views'
            ];

            for (const selector of viewSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent || element.innerText;
                // Match various number formats including commas, K, M suffixes
                const views = text.match(/(\d+(?:,\d+)*(?:\.\d+)?(?:\s*[KkMm]?)?)/);
                if (views) {
                  let viewCount = views[1].replace(/,/g, '');
                  // Handle K and M suffixes
                  if (viewCount.toLowerCase().includes('k')) {
                    viewCount = parseFloat(viewCount.replace(/[Kk]/g, '')) * 1000;
                  } else if (viewCount.toLowerCase().includes('m')) {
                    viewCount = parseFloat(viewCount.replace(/[Mm]/g, '')) * 1000000;
                  } else {
                    viewCount = parseFloat(viewCount);
                  }

                  if (!isNaN(viewCount)) {
                    result.views = Math.floor(viewCount);
                    break;
                  }
                }
              }
            }

            // Look for favorites/saves
            const favoriteSelectors = [
              '.favorites-count',
              '.favourites-count',
              '[data-qa="favorite-count"]',
              '.saved-count',
              '.watch-count'
            ];

            for (const selector of favoriteSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent || element.innerText;
                const favorites = text.match(/(\d+(?:,\d+)*(?:\.\d+)?(?:\s*[KkMm]?)?)/);
                if (favorites) {
                  let favoriteCount = favorites[1].replace(/,/g, '');
                  // Handle K and M suffixes
                  if (favoriteCount.toLowerCase().includes('k')) {
                    favoriteCount = parseFloat(favoriteCount.replace(/[Kk]/g, '')) * 1000;
                  } else if (favoriteCount.toLowerCase().includes('m')) {
                    favoriteCount = parseFloat(favoriteCount.replace(/[Mm]/g, '')) * 1000000;
                  } else {
                    favoriteCount = parseFloat(favoriteCount);
                  }

                  if (!isNaN(favoriteCount)) {
                    result.favorites = Math.floor(favoriteCount);
                    break;
                  }
                }
              }
            }

          } catch (error) {
            result.scrapeStatus = 'error';
            result.errorMessage = error.message;
          }

          return result;
        });

        await page.close();

        // If we got some data, return success
        if ((analytics.views > 0) || (analytics.favorites > 0) || (analytics.clicks > 0) || (analytics.shares > 0)) {
          console.log('[Kijiji] Returning analytics from detail page evaluation:', analytics);
          return {
            ...analytics,
            lastScraped: new Date(),
            listingUrl: url
          };
        }

        // If no data found, continue to retry
        throw new Error('No analytics data found');

      } catch (error) {
        lastError = error;
        console.log(`Kijiji scraping attempt ${attempt} failed:`, error.message);

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    return {
      views: 0,
      clicks: 0,
      favorites: 0,
      shares: 0,
      scrapeStatus: 'error',
      errorMessage: lastError?.message || 'Max retries exceeded',
      lastScraped: new Date(),
      listingUrl: url
    };
  }

  // Batch scrape multiple listings
  async scrapeListings(listings, credentials = null, cookies = null) {
    const results = [];
    const rateLimitDelay = 5000; // 5 seconds between requests to avoid rate limiting

    console.log(`Starting batch scraping of ${listings.length} listings`);

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];

      try {
        console.log(`Scraping listing ${i + 1}/${listings.length}: ${listing.title || listing._id}`);

        const result = {
          listingId: listing._id,
          analytics: {}
        };

        // Scrape Facebook if posted there
        if (listing.postedFacebookMarketplace && listing.analytics?.facebook?.listingUrl) {
          console.log(`  → Scraping Facebook: ${listing.analytics.facebook.listingUrl}`);
          result.analytics.facebook = await this.scrapeFacebookListing(
            listing.analytics.facebook.listingUrl,
            credentials, // Pass credentials for Facebook authentication
            cookies,
            listing.title || ''
          );
          console.log(`  → Facebook result: ${result.analytics.facebook.scrapeStatus}, views: ${result.analytics.facebook.views}`);
        }

        // Scrape Kijiji if posted there
        if (listing.postedKijijiCanada && listing.analytics?.kijiji?.listingUrl) {
          console.log(`  → Scraping Kijiji: ${listing.analytics.kijiji.listingUrl}`);
          result.analytics.kijiji = await this.scrapeKijijiListing(
            listing.analytics.kijiji.listingUrl,
            credentials,
            listing.title || ''
          );
          console.log(`  → Kijiji result: ${result.analytics.kijiji.scrapeStatus}, views: ${result.analytics.kijiji.views}`);
        }

        results.push(result);

        // Rate limiting - wait between requests (except for the last one)
        if (i < listings.length - 1) {
          console.log(`Waiting ${rateLimitDelay/1000}s before next listing...`);
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
        }

      } catch (error) {
        console.error(`Error scraping listing ${listing._id}:`, error);
        results.push({
          listingId: listing._id,
          analytics: {},
          error: error.message
        });
      }
    }

    console.log(`Batch scraping completed: ${results.length} listings processed`);
    return results;
  }
}

module.exports = new ScrapingService();

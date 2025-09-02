import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Refresh as RefreshIcon, Link as LinkIcon } from '@mui/icons-material';

const AnalyticsCard = ({ listingId, onUpdate }) => {
  const [analytics, setAnalytics] = useState({ facebook: {}, kijiji: {} });
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [kijijiUrl, setKijijiUrl] = useState('');
  const [facebookEmail, setFacebookEmail] = useState('');
  const [facebookPassword, setFacebookPassword] = useState('');
  const [showFacebookAuth, setShowFacebookAuth] = useState(false);
  const [facebookCookiesText, setFacebookCookiesText] = useState('');
  const [cookiesError, setCookiesError] = useState('');

  useEffect(() => {
    loadAnalytics();
    // Load saved Facebook auth for this listing from localStorage
    try {
      const saved = localStorage.getItem(`fbAuth:${listingId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setFacebookEmail(parsed.email);
        if (parsed.password) setFacebookPassword(parsed.password);
        if (parsed.cookiesText) setFacebookCookiesText(parsed.cookiesText);
      }
    } catch (e) {
      // ignore parsing errors
    }
  }, [listingId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/listings/${listingId}/analytics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics || { facebook: {}, kijiji: {} });

        // Set URLs if they exist
        if (data.analytics?.facebook?.listingUrl) {
          setFacebookUrl(data.analytics.facebook.listingUrl);
        }
        if (data.analytics?.kijiji?.listingUrl) {
          setKijijiUrl(data.analytics.kijiji.listingUrl);
        }
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Persist/clear Facebook auth locally per listing
  const handleSaveFacebookAuth = () => {
    try {
      const payload = {
        email: facebookEmail || '',
        password: facebookPassword || '',
        cookiesText: facebookCookiesText || ''
      };
      localStorage.setItem(`fbAuth:${listingId}`, JSON.stringify(payload));
      setSuccess('Facebook credentials/cookies saved locally.');
    } catch (e) {
      setError('Failed to save credentials locally');
    }
  };

  const handleClearFacebookAuth = () => {
    try {
      localStorage.removeItem(`fbAuth:${listingId}`);
      setFacebookEmail('');
      setFacebookPassword('');
      setFacebookCookiesText('');
      setSuccess('Facebook credentials/cookies cleared.');
    } catch (e) {
      setError('Failed to clear credentials');
    }
  };

  const handleScrape = async () => {
    try {
      setScraping(true);
      setError('');
      setSuccess('');
      setCookiesError('');

      const token = localStorage.getItem('token');

      // Prepare request body with optional Facebook credentials and cookies
      const requestBody = {};
      if (facebookEmail && facebookPassword) {
        requestBody.facebookCredentials = {
          email: facebookEmail,
          password: facebookPassword
        };
      }

      if (facebookCookiesText && facebookCookiesText.trim()) {
        try {
          const parsed = JSON.parse(facebookCookiesText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            requestBody.facebookCookies = parsed;
          } else {
            setCookiesError('Cookies JSON must be a non-empty array.');
          }
        } catch (e) {
          setCookiesError('Invalid JSON format for cookies.');
        }
      }

      const response = await fetch(`/api/listings/${listingId}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
        setSuccess('Analytics updated successfully!');
        if (onUpdate) onUpdate();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to scrape analytics');
      }
    } catch (err) {
      setError('Failed to scrape analytics');
      console.error(err);
    } finally {
      setScraping(false);
    }
  };

  const handleUpdateUrls = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/listings/${listingId}/analytics-urls`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          facebookUrl: facebookUrl || undefined,
          kijijiUrl: kijijiUrl || undefined,
        }),
      });

      if (response.ok) {
        setSuccess('URLs updated successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update URLs');
      }
    } catch (err) {
      setError('Failed to update URLs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  if (loading && !analytics.facebook && !analytics.kijiji) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h3">
            Listing Analytics
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleScrape}
            disabled={scraping}
            size="small"
          >
            {scraping ? 'Scraping...' : 'Refresh Data'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Facebook Authentication */}
        {facebookUrl && (
          <Box mb={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                Facebook Authentication (Optional)
              </Typography>
              <Button
                size="small"
                onClick={() => setShowFacebookAuth(!showFacebookAuth)}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                {showFacebookAuth ? 'Hide' : 'Show'}
              </Button>
            </Box>

            {showFacebookAuth && (
              <Grid container spacing={2}>
                <Grid item size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Facebook Email"
                    value={facebookEmail}
                    onChange={(e) => setFacebookEmail(e.target.value)}
                    placeholder="your@email.com"
                    size="small"
                    helperText="Required for private marketplace pages"
                  />
                </Grid>
                <Grid item size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Facebook Password"
                    value={facebookPassword}
                    onChange={(e) => setFacebookPassword(e.target.value)}
                    placeholder="••••••••"
                    size="small"
                    helperText="Your Facebook account password"
                  />
                </Grid>
                <Grid item size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Facebook Cookies JSON (optional)"
                    value={facebookCookiesText}
                    onChange={(e) => setFacebookCookiesText(e.target.value)}
                    placeholder="Paste cookies JSON array exported from your browser here"
                    size="small"
                    error={Boolean(cookiesError)}
                    helperText={cookiesError || 'Recommended: use cookie export from your logged-in browser to bypass login.'}
                  />
                </Grid>
                <Grid item size={{ xs: 12 }}>
                  <Box display="flex" gap={1}>
                    <Button variant="outlined" size="small" onClick={handleSaveFacebookAuth}>Save Auth</Button>
                    <Button variant="text" size="small" onClick={handleClearFacebookAuth}>Clear</Button>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* URL Configuration */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Configure Listing URLs for Analytics
          </Typography>
          <Grid container spacing={2}>
            <Grid item size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Facebook Marketplace URL"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/marketplace/item/..."
                size="small"
              />
            </Grid>
            <Grid item size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Kijiji URL"
                value={kijijiUrl}
                onChange={(e) => setKijijiUrl(e.target.value)}
                placeholder="https://www.kijiji.ca/v-..."
                size="small"
              />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            onClick={handleUpdateUrls}
            disabled={loading}
            sx={{ mt: 1 }}
            size="small"
          >
            Update URLs
          </Button>
        </Box>

        {/* Analytics Display */}
        <Grid container spacing={2}>
          {/* Facebook Analytics */}
          <Grid item size={{ xs: 12, md: 6 }}>
            <Box border={1} borderColor="divider" borderRadius={1} p={2}>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  Facebook Marketplace
                </Typography>
                <Chip
                  label={analytics.facebook?.scrapeStatus || 'No URL'}
                  color={getStatusColor(analytics.facebook?.scrapeStatus)}
                  size="small"
                />
              </Box>

              <Grid container spacing={1}>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Views</Typography>
                  <Typography variant="h6">{analytics.facebook?.views || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Clicks</Typography>
                  <Typography variant="h6">{analytics.facebook?.clicks || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Favorites</Typography>
                  <Typography variant="h6">{analytics.facebook?.favorites || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Shares</Typography>
                  <Typography variant="h6">{analytics.facebook?.shares || 0}</Typography>
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Last scraped: {formatDate(analytics.facebook?.lastScraped)}
              </Typography>

              {analytics.facebook?.errorMessage && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  Error: {analytics.facebook.errorMessage}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Kijiji Analytics */}
          <Grid item size={{ xs: 12, md: 6 }}>
            <Box border={1} borderColor="divider" borderRadius={1} p={2}>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  Kijiji Canada
                </Typography>
                <Chip
                  label={analytics.kijiji?.scrapeStatus || 'No URL'}
                  color={getStatusColor(analytics.kijiji?.scrapeStatus)}
                  size="small"
                />
              </Box>

              <Grid container spacing={1}>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Views</Typography>
                  <Typography variant="h6">{analytics.kijiji?.views || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Clicks</Typography>
                  <Typography variant="h6">{analytics.kijiji?.clicks || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Favorites</Typography>
                  <Typography variant="h6">{analytics.kijiji?.favorites || 0}</Typography>
                </Grid>
                <Grid item size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Shares</Typography>
                  <Typography variant="h6">{analytics.kijiji?.shares || 0}</Typography>
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Last scraped: {formatDate(analytics.kijiji?.lastScraped)}
              </Typography>

              {analytics.kijiji?.errorMessage && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  Error: {analytics.kijiji.errorMessage}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;

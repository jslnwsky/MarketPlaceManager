import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Alert,
  CircularProgress,
  TextField,
  Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add as AddIcon } from '@mui/icons-material';

function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [activeStatuses, setActiveStatuses] = useState([]); // e.g., ['Created','Posted']

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const resp = await fetch('/api/listings', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Failed to load listings');
        }
        const data = await resp.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || 'Failed to load listings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getDerivedStatus = (it) => {
    const hasSold = it.soldFacebookMarketplace || it.soldKijijiCanada;
    const hasPosted = it.postedFacebookMarketplace || it.postedKijijiCanada;
    if (hasSold) return 'Sold';
    if (hasPosted) return 'Posted';
    return 'Created';
  };

  const stats = useMemo(() => {
    const byStatus = items.reduce(
      (acc, it) => {
        const derivedStatus = getDerivedStatus(it);
        acc[derivedStatus] = (acc[derivedStatus] || 0) + 1;
        return acc;
      },
      { Created: 0, Posted: 0, Sold: 0 }
    );

    return [
      { key: 'Created', title: 'Created Listings', value: String(byStatus.Created) },
      { key: 'Posted', title: 'Posted Listings', value: String(byStatus.Posted) },
      { key: 'Sold', title: 'Sold Listings', value: String(byStatus.Sold) },
    ];
  }, [items]);

  // Totals for Posted and Sold (sum of item.price)
  const { postedTotal, soldTotal } = useMemo(() => {
    const fmt = (n) => (Number.isFinite(n) ? n : 0);
    let pTotal = 0;
    let sTotal = 0;
    for (const it of items) {
      const status = getDerivedStatus(it);
      const priceNum = fmt(Number(it?.price));
      if (status === 'Posted') pTotal += priceNum;
      if (status === 'Sold') sTotal += priceNum;
    }
    return { postedTotal: pTotal, soldTotal: sTotal };
  }, [items]);

  // Currency formatter
  const moneyFmt = useMemo(() => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }), []);

  const toggleStatus = (key) => {
    setActiveStatuses((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key); else set.add(key);
      return Array.from(set);
    });
  };

  const recentListings = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const filtered = activeStatuses.length
      ? sorted.filter((it) => activeStatuses.includes(getDerivedStatus(it)))
      : sorted;
    return filtered.slice(0, 6);
  }, [items, activeStatuses]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header: welcome text only (actions moved to AppBar) */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" color="text.secondary">
          Welcome back! Here's what's happening with your listings.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* KPI tiles as filter toggles + inline totals */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat) => {
          const selected = activeStatuses.includes(stat.key);
          return (
            <Grid item xs={12} sm={3} key={stat.key}>
              <Tooltip title={selected ? 'Filtering by this status' : 'Click to filter'}>
                <Paper
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleStatus(stat.key)}
                  sx={{
                    p: 2,
                    height: '100%',
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'action.selected' : 'background.paper',
                    borderRadius: 2,
                    transition: 'background-color 120ms ease, border-color 120ms ease',
                    '&:hover': { borderColor: 'primary.main' },
                    outline: 'none',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {stat.title}
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
                    {stat.value}
                  </Typography>
                </Paper>
              </Tooltip>
            </Grid>
          );
        })}
        {/* Totals column */}
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Totals
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Posted Total: {moneyFmt.format(postedTotal)}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Sold Total: {moneyFmt.format(soldTotal)}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Listings */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Recent Listings
          </Typography>
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 2,
        }}>
          {recentListings.map((item) => {
            const id = item._id || item.id;
            const firstImage = Array.isArray(item.images) && item.images.length
              ? item.images[0].url
              : 'https://via.placeholder.com/300x200?text=No+Image';

            // Derived status for display
            const derivedStatus = getDerivedStatus(item);

            // Local controlled values seeded from analytics
            const fbClicks = item.analytics?.facebook?.clicks ?? '';
            const kjViews = item.analytics?.kijiji?.views ?? '';

            const handleSave = async (e) => {
              e.stopPropagation();
              const fbVal = Number((document.getElementById(`fb-clicks-${id}`) || {}).value ?? '');
              const kjVal = Number((document.getElementById(`kj-views-${id}`) || {}).value ?? '');
              const body = {};
              if (!Number.isNaN(fbVal) && fbVal !== '') body.facebookClicks = fbVal;
              if (!Number.isNaN(kjVal) && kjVal !== '') body.kijijiViews = kjVal;
              if (Object.keys(body).length === 0) return;
              try {
                setSavingId(id);
                const token = localStorage.getItem('token');
                const resp = await fetch(`/api/listings/${id}/analytics-manual`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(body),
                });
                if (!resp.ok) {
                  const t = await resp.text();
                  throw new Error(t || 'Failed to save analytics');
                }
                const data = await resp.json();
                // Update local items state
                setItems((prev) => prev.map((it) => (
                  (it._id || it.id) === id ? { ...it, analytics: data.analytics } : it
                )));
              } catch (err) {
                setError(err.message || 'Failed to save analytics');
              } finally {
                setSavingId('');
              }
            };

            const stop = (e) => e.stopPropagation();

            return (
              <Box key={id}>
                <Card
                  sx={{
                    width: '100%',
                    height: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                    }
                  }}
                  onClick={() => navigate(`/listings/${id}`)}
                >
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      height="180"
                      image={firstImage}
                      alt={item.title}
                      sx={{ objectFit: 'cover' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        bgcolor:
                          derivedStatus === 'Sold' ? 'success.main' :
                          derivedStatus === 'Posted' ? 'info.main' :
                          'grey.600',
                        color: 'common.white',
                      }}
                    >
                      {derivedStatus}
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 2, pb: 1, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <Typography
                      variant="body2"
                      component="h3"
                      sx={{
                        fontWeight: 500,
                        mb: 1,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                      title={item.title}
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600, mb: 1 }}>
                      {moneyFmt.format(Number(item.price) || 0)}
                    </Typography>

                    {/* Analytics Summary (show only Facebook to avoid duplication with manual Kijiji input) */}
                    {(() => {
                      const fbViewsNum = Number(item.analytics?.facebook?.views || 0);
                      if (fbViewsNum <= 0) return null;
                      return (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            FB: {fbViewsNum} views
                          </Typography>
                        </Box>
                      );
                    })()}

                    {/* Compact analytics footer */}
                    <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }} onClick={stop} onMouseDown={stop}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          id={`fb-clicks-${id}`}
                          label="FB Clicks"
                          type="number"
                          size="small"
                          defaultValue={fbClicks}
                          inputProps={{ min: 0 }}
                          sx={{ width: 110 }}
                        />
                        <TextField
                          id={`kj-views-${id}`}
                          label="Kijiji Views"
                          type="number"
                          size="small"
                          defaultValue={kjViews}
                          inputProps={{ min: 0 }}
                          sx={{ width: 130 }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSave}
                          disabled={savingId === id}
                        >
                          {savingId === id ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Quick Actions moved to header */}
    </Box>
  );
}

export default Dashboard;

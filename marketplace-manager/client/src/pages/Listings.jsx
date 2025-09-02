import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, CardMedia, CardActions, Button, TextField, InputAdornment, Paper, Alert, Chip, Stack, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';

function Listings() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
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
      }
    };
    load();
  }, []);

  const filtered = items.filter(i => i.title.toLowerCase().includes(query.toLowerCase()));

  const deriveStatus = (item) => {
    const sold = !!(item.soldFacebookMarketplace || item.soldKijijiCanada);
    if (sold) return 'Sold';
    const posted = !!(item.postedFacebookMarketplace || item.postedKijijiCanada);
    if (posted) return 'Posted';
    return 'Created';
  };

  const statusColor = (status) => {
    switch (status) {
      case 'Sold':
        return 'success';
      case 'Posted':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">My Listings</Typography>
        <Button variant="contained" onClick={() => navigate('/listings/new')}>New Listing</Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search your listings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      <Grid container spacing={3}>
        {filtered.map(item => {
          const firstImage = Array.isArray(item.images) && item.images.length ? item.images[0].url : 'https://via.placeholder.com/400x240?text=No+Image';
          const id = item._id || item.id;
          return (
            <Grid item xs={12} sm={6} md={4} key={id}>
              <Card>
                <CardMedia component="img" height="180" image={firstImage} alt={item.title} />
                <CardContent>
                  <Typography variant="h6">{item.title}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography color="primary" fontWeight={600}>${item.price}</Typography>
                    {(() => {
                      const status = deriveStatus(item);
                      return <Chip size="small" label={status} color={statusColor(status)} />;
                    })()}
                  </Stack>
                  {(item.postedFacebookMarketplace || item.postedKijijiCanada) && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                      {item.postedFacebookMarketplace && (
                        <Tooltip title="Posted to Facebook Marketplace" arrow>
                          <Chip size="small" label="FB" variant="outlined" />
                        </Tooltip>
                      )}
                      {item.postedKijijiCanada && (
                        <Tooltip title="Posted to Kijiji Canada" arrow>
                          <Chip size="small" label="Kijiji" variant="outlined" />
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </CardContent>
                <CardActions>
                  <Button onClick={() => navigate(`/listings/${id}`)}>View</Button>
                  <Button onClick={() => navigate(`/listings/${id}/edit`)}>Edit</Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default Listings;

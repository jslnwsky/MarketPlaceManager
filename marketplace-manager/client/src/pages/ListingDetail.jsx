import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, Chip, CircularProgress, Alert } from '@mui/material';
import AnalyticsCard from '../components/AnalyticsCard';

function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        setLoading(true);
        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Failed to load listing');
        }
        const data = await resp.json();
        setItem(data);
      } catch (e) {
        setError(e.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAnalyticsUpdate = () => {
    // Reload the listing data when analytics are updated
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (resp.ok) {
          const data = await resp.json();
          setItem(data);
        }
      } catch (e) {
        console.error('Failed to reload listing:', e);
      }
    };
    load();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Box>
    );
  }

  if (!item) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{item.title}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => navigate(`/listings/${id}/edit`)}>Edit</Button>
          <Button variant="text" onClick={() => navigate(-1)}>Back</Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2 }}>
            <img
              src={(Array.isArray(item.images) && item.images.length ? item.images[0].url : 'https://via.placeholder.com/800x480?text=No+Image')}
              alt={item.title}
              style={{ width: '100%', borderRadius: 8 }}
            />
          </Paper>
        </Grid>
        <Grid item size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" sx={{ mb: 2 }}>${item.price}</Typography>
            <Typography sx={{ mb: 2 }}>{item.description}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={item.category} />
              <Chip label={item.condition} />
              <Chip label={item.location} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Analytics Section */}
      <Box sx={{ mt: 4 }}>
        <AnalyticsCard listingId={id} onUpdate={handleAnalyticsUpdate} />
      </Box>
    </Box>
  );
}

export default ListingDetail;

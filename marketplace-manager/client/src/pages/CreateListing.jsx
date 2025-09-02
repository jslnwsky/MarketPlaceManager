import React, { useState } from 'react';
import { Box, Typography, TextField, Grid, Paper, Button, MenuItem, InputLabel, Select, FormControl, Alert, CircularProgress, Divider, List, ListItem, ListItemText, FormControlLabel, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

const categories = [
  'Appliances','Electronics','Furniture','Home Goods','Clothing & Shoes','Health & Beauty','Toys & Games','Garden & Outdoor','Auto Parts','Sports & Outdoors','Musical Instruments','Pet Supplies','Other'
];

function CreateListing() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'Used - Good',
    location: '',
    brand: '',
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [sources, setSources] = useState([]);
  const [pricing, setPricing] = useState(false);
  const [rationale, setRationale] = useState('');
  const [detailLevel, setDetailLevel] = useState('standard'); // concise | standard | detailed
  const [appendMode, setAppendMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleRecommendPrice = async () => {
    setError('');
    setSuccess('');
    setRationale('');
    try {
      setPricing(true);
      const payload = {
        title: form.title,
        condition: form.condition,
      };
      const resp = await fetch('/api/ai/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Price recommend failed: ${txt}`);
      }
      const data = await resp.json();
      const r = data?.result || {};
      // Primary suggested price
      if (typeof r.suggested_price !== 'undefined') {
        setForm(prev => ({ ...prev, price: String(r.suggested_price) }));
      }
      // Fallback: if low/high provided, compute midpoint
      if (typeof r.suggested_price === 'undefined' && typeof r.low === 'number' && typeof r.high === 'number') {
        const mid = Math.round(((r.low + r.high) / 2) * 100) / 100;
        if (!Number.isNaN(mid)) {
          setForm(prev => ({ ...prev, price: String(mid) }));
          r.suggested_price = mid; // reflect in UI below
        }
      }
      setSources(Array.isArray(r.sources) ? r.sources : []);
      setRationale(r.rationale || '');
      const range = (r.low && r.high) ? ` (range: ${r.low}-${r.high} ${r.currency || ''})` : '';
      if (typeof r.suggested_price === 'undefined') {
        setSuccess('No price returned. Try again in a moment or adjust the title.');
        return;
      } else {
        setSuccess(`Recommended price${r.currency ? ` (${r.currency})` : ''}${range}.`);
      }
    } catch (e) {
      setError(e.message || 'Failed to recommend price');
    } finally {
      setPricing(false);
    }
  };

  const handleImages = (e) => {
    setImages(Array.from(e.target.files || []));
  };

  const handleGenerateFromImage = async () => {
    setError('');
    setSuccess('');
    setSources([]);
    if (!images.length) {
      setError('Please select at least one image before generating.');
      return;
    }
    try {
      setGenerating(true);
      const fd = new FormData();
      fd.append('image', images[0]);
      const resp = await fetch('/api/ai/identify', { method: 'POST', body: fd });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Identify failed: ${txt}`);
      }
      const data = await resp.json();
      const d = data?.draft || {};
      setForm(prev => ({
        ...prev,
        title: d.title || prev.title,
        description: d.short_description || prev.description,
        category: d.category || prev.category,
        brand: d.brand || prev.brand,
      }));
      setSuccess('Generated details from image. Review and edit as needed.');
    } catch (e) {
      setError(e.message || 'Failed to generate from image');
    } finally {
      setGenerating(false);
    }
  };

  const handleEnrich = async () => {
    setError('');
    setSuccess('');
    setSources([]);
    try {
      setEnriching(true);
      const tokenMap = { concise: 600, standard: 1500, detailed: 3000 };
      const payload = {
        brand: form.brand || undefined,
        model: undefined,
        hints: form.title ? `Listing title: ${form.title}. ${form.description ? 'Context: ' + form.description : ''}` : undefined,
        max_tokens: tokenMap[detailLevel] || 1500,
        detail_level: detailLevel,
      };
      const resp = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Enrich failed: ${txt}`);
      }
      const data = await resp.json();
      const r = data?.result || {};
      let updated = false;
      setForm(prev => {
        const next = { ...prev };
        if (r.title && r.title !== prev.title) { next.title = r.title; updated = true; }
        if (r.description) {
          if (appendMode && prev.description && r.description !== prev.description) {
            next.description = `${prev.description}\n\n${r.description}`;
          } else if (r.description !== prev.description) {
            next.description = r.description;
          }
          updated = true;
        }
        return next;
      });
      const srcs = Array.isArray(r.sources) ? r.sources : [];
      setSources(srcs);
      setSuccess(updated ? 'Enhanced description using web info.' : 'No additional info found to enhance.');
    } catch (e) {
      setError(e.message || 'Failed to enhance');
    } finally {
      setEnriching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title || !form.price || !form.category) {
      setError('Title, price, and category are required.');
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description || '');
      fd.append('price', form.price);
      fd.append('category', form.category);
      fd.append('condition', form.condition || '');
      fd.append('brand', form.brand || '');
      fd.append('location', form.location || '');
      images.forEach((img) => fd.append('images', img));

      const token = localStorage.getItem('token');
      const resp = await fetch('/api/listings', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Create failed: ${txt}`);
      }
      const created = await resp.json();
      setSuccess('Listing created.');
      // Reset form
      setForm({ title: '', description: '', price: '', category: '', condition: 'Used - Good', location: '', brand: '' });
      setImages([]);
      // Optional: navigate to listings detail or list page later
      console.debug('Created listing', created);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Create Listing</Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField label="Title" name="title" value={form.title} onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
              <TextField label="Description" name="description" value={form.description} onChange={handleChange} fullWidth multiline minRows={4} sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={handleGenerateFromImage} disabled={generating || !images.length}>
                  {generating ? <CircularProgress size={18} /> : 'Generate from Image'}
                </Button>
                <Button variant="outlined" onClick={handleEnrich} disabled={enriching}>
                  {enriching ? <CircularProgress size={18} /> : 'Enhance with Web Info'}
                </Button>
                <Button variant="outlined" onClick={handleRecommendPrice} disabled={pricing}>
                  {pricing ? <CircularProgress size={18} /> : 'Recommend Price'}
                </Button>
                <Button variant="text" onClick={() => setEditorOpen(true)}>Full-screen editor</Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="detail-level-label">Detail level</InputLabel>
                  <Select labelId="detail-level-label" label="Detail level" value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)}>
                    <MenuItem value="concise">Concise</MenuItem>
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="detailed">Detailed</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel control={<Checkbox checked={appendMode} onChange={(e) => setAppendMode(e.target.checked)} />} label="Append to description" />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Price" name="price" type="number" value={form.price} onChange={handleChange} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="category-label">Category</InputLabel>
                    <Select labelId="category-label" label="Category" name="category" value={form.category} onChange={handleChange}>
                      {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Condition" name="condition" value={form.condition} onChange={handleChange} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Brand" name="brand" value={form.brand} onChange={handleChange} fullWidth />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button variant="outlined" component="label" fullWidth sx={{ height: 56 }}>
                Upload Images
                <input hidden type="file" accept="image/*" multiple onChange={handleImages} />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {images.length ? `${images.length} image(s) selected` : 'Up to 10 images, JPG/PNG'}
              </Typography>
              <TextField label="Pickup location/notes" name="location" value={form.location} onChange={handleChange} fullWidth sx={{ mt: 2 }} placeholder="e.g., Downtown Toronto, evenings only, porch pickup" />
              {!!sources.length && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2">Sources</Typography>
                  <List dense>
                    {sources.map((s, idx) => (
                      <ListItem key={idx} sx={{ py: 0 }}>
                        <ListItemText primary={s.title || s.url} secondary={s.url} primaryTypographyProps={{ noWrap: true }} secondaryTypographyProps={{ noWrap: true }} />
                      </ListItem>
                    ))}
                  </List>
                  {rationale && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Rationale: {rationale}
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={22} /> : 'Create Listing'}
            </Button>
            <Button type="button" variant="text" onClick={() => window.history.back()}>Cancel</Button>
          </Box>
        </Box>
      </Paper>

      {/* Full-screen description editor */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullScreen>
        <DialogTitle>Edit Description</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={20}
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CreateListing;

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Grid, Paper, Button, MenuItem, InputLabel, Select, FormControl, Alert, CircularProgress, Divider, List, ListItem, ListItemText, FormControlLabel, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

const categories = [
  'Appliances','Electronics','Furniture','Home Goods','Clothing & Shoes','Health & Beauty','Toys & Games','Garden & Outdoor','Auto Parts','Sports & Outdoors','Musical Instruments','Pet Supplies','Other'
];

function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', price: '', category: '', condition: 'Used - Good', location: '', brand: '', status: 'Active', postedFacebookMarketplace: false, postedKijijiCanada: false, soldFacebookMarketplace: false, soldKijijiCanada: false });
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imageMeta, setImageMeta] = useState([]); // [{w,h}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [sources, setSources] = useState([]);
  const [rationale, setRationale] = useState('');
  const [detailLevel, setDetailLevel] = useState('standard'); // concise | standard | detailed
  const [appendMode, setAppendMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Failed to load listing');
        }
        const data = await resp.json();
        setForm({
          title: data.title || '',
          description: data.description || '',
          price: data.price ?? '',
          category: data.category || '',
          condition: data.condition || 'Used - Good',
          location: data.location || '',
          brand: data.brand || '',
          status: data.status || 'Active',
          postedFacebookMarketplace: !!data.postedFacebookMarketplace,
          postedKijijiCanada: !!data.postedKijijiCanada,
          soldFacebookMarketplace: !!data.soldFacebookMarketplace,
          soldKijijiCanada: !!data.soldKijijiCanada,
        });
        const imgs = Array.isArray(data.images) ? data.images : [];
        setExistingImages(imgs);
        // Load natural dimensions for thumbnails
        const loads = imgs.map((img) => new Promise((resolve) => {
          const i = new Image();
          i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight });
          i.onerror = () => resolve({ w: undefined, h: undefined });
          i.src = img.url;
        }));
        const metas = await Promise.all(loads);
        setImageMeta(metas);
      } catch (e) {
        setError(e.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImages = (e) => {
    setImages(Array.from(e.target.files || []));
  };

  const handleGenerateFromImage = async () => {
    setError('');
    setSuccess('');
    setSources([]);
    if (!images.length) {
      setError('Please select at least one new image before generating.');
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
      if (typeof r.suggested_price !== 'undefined') {
        setForm(prev => ({ ...prev, price: String(r.suggested_price) }));
      }
      setSources(Array.isArray(r.sources) ? r.sources : []);
      setRationale(r.rationale || '');
      const range = (r.low && r.high) ? ` (range: ${r.low}-${r.high} ${r.currency || ''})` : '';
      if (typeof r.suggested_price === 'undefined') {
        setSuccess('No price returned. Try adding title/brand/category or switch to Detailed enrich for more context.');
      } else {
        setSuccess(`Recommended price${r.currency ? ` (${r.currency})` : ''}${range}.`);
      }
    } catch (e) {
      setError(e.message || 'Failed to recommend price');
    } finally {
      setPricing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title || !form.price) {
      setError('Title and price are required.');
      return;
    }

    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description || '');
      fd.append('price', form.price);
      fd.append('category', form.category || '');
      fd.append('condition', form.condition || '');
      fd.append('brand', form.brand || '');
      fd.append('location', form.location || '');
      fd.append('status', form.status || '');
      fd.append('postedFacebookMarketplace', String(!!form.postedFacebookMarketplace));
      fd.append('postedKijijiCanada', String(!!form.postedKijijiCanada));
      fd.append('soldFacebookMarketplace', String(!!form.soldFacebookMarketplace));
      fd.append('soldKijijiCanada', String(!!form.soldKijijiCanada));
      images.forEach((img) => fd.append('images', img));

      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Failed to update listing');
      }
      await resp.json();
      setSuccess('Listing updated.');
      setImages([]);
    } catch (err) {
      setError(err.message || 'Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Edit Listing</Typography>
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
                  <FormControl fullWidth>
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
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Checkbox checked={form.postedFacebookMarketplace} onChange={(e) => setForm(prev => ({ ...prev, postedFacebookMarketplace: e.target.checked }))} />}
                    label="Posted to Facebook Marketplace"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={form.postedKijijiCanada} onChange={(e) => setForm(prev => ({ ...prev, postedKijijiCanada: e.target.checked }))} />}
                    label="Posted to Kijiji Canada"
                  />
                  <Divider sx={{ my: 1 }} />
                  <FormControlLabel
                    control={<Checkbox checked={form.soldFacebookMarketplace} onChange={(e) => setForm(prev => {
                      const soldFacebookMarketplace = e.target.checked;
                      const newSold = soldFacebookMarketplace || prev.soldKijijiCanada;
                      return { ...prev, soldFacebookMarketplace, status: newSold ? 'Sold' : 'Active' };
                    })} />}
                    label="Sold on Facebook"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={form.soldKijijiCanada} onChange={(e) => setForm(prev => {
                      const soldKijijiCanada = e.target.checked;
                      const newSold = prev.soldFacebookMarketplace || soldKijijiCanada;
                      return { ...prev, soldKijijiCanada, status: newSold ? 'Sold' : 'Active' };
                    })} />}
                    label="Sold on Kijiji"
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button variant="outlined" component="label" fullWidth sx={{ height: 56 }}>
                Upload Images
                <input hidden type="file" accept="image/*" multiple onChange={handleImages} />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {images.length ? `${images.length} new image(s) selected` : 'Add more images (optional)'}
              </Typography>
              {!!existingImages.length && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2">Existing Images</Typography>
                  <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {existingImages.map((img, idx) => (
                      <Grid item key={idx} xs={12} sm={6}>
                        <Box>
                          <Box sx={{
                            width: '100%',
                            height: 220,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: 'background.default',
                          }}>
                            <img
                              src={img.url}
                              alt={img.filename || `image-${idx}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {(img.filename || `image-${idx}`)}
                            {(() => {
                              const meta = imageMeta[idx] || {};
                              return meta.w && meta.h ? ` — ${meta.w}×${meta.h}` : '';
                            })()}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
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
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} /> : 'Save Changes'}
            </Button>
            <Button type="button" variant="text" onClick={() => navigate(-1)}>Cancel</Button>
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

export default EditListing;

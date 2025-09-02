import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Drawer, 
  List, 
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ListAlt as ListingsIcon,
  Add as AddIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'My Listings', icon: <ListingsIcon />, path: '/listings' },
  { text: 'Create Listing', icon: <AddIcon />, path: '/listings/new' },
];

function Layout({ children }) {
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Marketplace Manager
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={logout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          {isMobile && (
            <Button
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </Button>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Marketplace Manager'}
          </Typography>
          {/* Quick Actions in AppBar (hidden on small screens) */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button
              color="inherit"
              component={Link}
              to="/listings/new"
              startIcon={<AddIcon />}
              variant="outlined"
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.6)' }
              }}
            >
              New Listing
            </Button>
            <Button
              color="inherit"
              component={Link}
              to="/listings"
              variant="outlined"
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.6)' }
              }}
            >
              View All Listings
            </Button>
            <Button color="inherit" variant="outlined" sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.6)' } }}>
              View Messages
            </Button>
            <Button color="inherit" variant="outlined" sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.6)' } }}>
              View Sales
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>
    </Box>
  );
}

export default Layout;

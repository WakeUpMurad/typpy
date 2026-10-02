import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';
import { App } from './App';
import './style.css';

const client = new QueryClient();
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#63f5ce' },
    secondary: { main: '#78b9ff' },
    background: { default: '#080c17', paper: '#141d31' },
    text: { primary: '#e6edf9', secondary: '#a1adc4' },
    success: { main: '#63f5ce' },
    error: { main: '#ff91a4' },
  },
  typography: { fontFamily: 'Manrope, Arial, sans-serif', button: { textTransform: 'none' } },
  components: { MuiButton: { styleOverrides: { root: { minWidth: 0, lineHeight: 1.5 } } } },
});
createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </ThemeProvider>,
);

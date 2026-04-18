import { HashRouter, Route, Routes } from 'react-router-dom';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

export const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  );
};

export const AppLite = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </HashRouter>
  );
};

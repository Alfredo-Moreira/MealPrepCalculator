import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import CreatePlan from './pages/CreatePlan';
import ViewPlan from './pages/ViewPlan';
import FoodDatabase from './pages/FoodDatabase';
import SplashScreen from './components/SplashScreen';
import { BrandMark, DatabaseIcon } from './components/icons';

const SPLASH_KEY = 'mpc:splashSeen';

function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Users />} />
          <Route path="/user/:id" element={<UserDetail />} />
          <Route path="/create" element={<CreatePlan />} />
          <Route path="/plan/:id" element={<ViewPlan />} />
          <Route path="/foods" element={<FoodDatabase />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SPLASH_KEY) !== '1',
  );

  const dismissSplash = () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      /* sessionStorage unavailable — fine, just dismiss */
    }
    setShowSplash(false);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" onDone={dismissSplash} />}
      </AnimatePresence>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark className="h-7 w-7 text-brand" />
            <span className="text-lg font-bold tracking-tight text-ink">MacroLeaf</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/foods"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted no-underline transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <DatabaseIcon className="h-4 w-4" />
              Food Database
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <AnimatedRoutes />
      </main>
    </div>
  );
}

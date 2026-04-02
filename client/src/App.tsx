import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreatePlan from './pages/CreatePlan';
import ViewPlan from './pages/ViewPlan';
import FoodDatabase from './pages/FoodDatabase';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900 no-underline">
            Meal Prep Calculator
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/foods"
              className="text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors no-underline"
            >
              Food Database
            </Link>
            <Link
              to="/create"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors no-underline"
            >
              + New Plan
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreatePlan />} />
          <Route path="/plan/:id" element={<ViewPlan />} />
          <Route path="/foods" element={<FoodDatabase />} />
        </Routes>
      </main>
    </div>
  );
}

import { createBrowserRouter, Navigate } from 'react-router-dom';
import Home from '../pages/Home/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Board from '../pages/Board/Board';
import Dashboard from '../pages/Dashboard';
import Profile from '../pages/Profile';
import GithubCallback from '../pages/Auth/GithubCallback';
import GoogleCallback from '../pages/Auth/GoogleCallback';
import ProtectedRoute from '../components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  {
    path: '/board/:id',
    element: (
      <ProtectedRoute>
        <Board />
      </ProtectedRoute>
    ),
  },
  {
    path: '/auth/github/callback',
    element: <GithubCallback />,
  },
  {
    path: '/auth/google/callback',
    element: <GoogleCallback />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
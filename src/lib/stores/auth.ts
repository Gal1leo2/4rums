import { writable } from 'svelte/store';

// Create a mock user object
const mockUser = {
  id: 'mock-user-id',
  email: 'admin@example.com',
  user_metadata: {
    full_name: 'Admin User'
  },
  role: 'instructor'
};

// Create stores with initial values
export const user = writable(null);
export const isAuthenticated = writable(false);

// Simple login function
export const login = () => {
  user.set(mockUser);
  isAuthenticated.set(true);
  localStorage.setItem('isAuthenticated', 'true');
};

// Simple logout function
export const logout = () => {
  user.set(null);
  isAuthenticated.set(false);
  localStorage.removeItem('isAuthenticated');
};

// Initialize auth state from localStorage
export const initAuth = () => {
  const auth = localStorage.getItem('isAuthenticated');
  if (auth === 'true') {
    user.set(mockUser);
    isAuthenticated.set(true);
  }
};
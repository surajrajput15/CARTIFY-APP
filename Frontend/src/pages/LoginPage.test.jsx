import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

const mockLogin = vi.fn();
vi.mock('../context/authContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
  }),
}));

vi.mock('../context/googleIdentityContext', () => ({
  useGoogleIdentity: () => ({
    status: 'ready',
    renderButton: vi.fn(),
    signInWithGoogle: vi.fn(),
  }),
}));

vi.mock('../services/authApi', () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  loginWithPassword: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

import { sendOtp } from '../services/authApi';

describe('LoginPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders OTP login by default with mode switch buttons', () => {
    render(<LoginPage />);
    expect(screen.getByText('Login with OTP')).toBeInTheDocument();
    expect(screen.getByText('Email & Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get otp/i })).toBeInTheDocument();
  });

  it('switches between OTP and Password login modes', () => {
    render(<LoginPage />);
    const passwordModeBtn = screen.getByText('Email & Password');
    fireEvent.click(passwordModeBtn);

    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/min\. 8 characters/i)).toBeInTheDocument();
  });

  it('switches to create account (registration) mode in password tab', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('Email & Password'));

    const signUpToggleBtn = screen.getByRole('button', { name: /don't have an account\? sign up/i });
    fireEvent.click(signUpToggleBtn);

    expect(screen.getByPlaceholderText(/john doe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
  });

  it('submits send OTP request when valid email is entered', async () => {
    sendOtp.mockResolvedValueOnce({ data: { message: 'OTP sent' } });
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /get otp/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sendOtp).toHaveBeenCalledWith({ email: 'user@example.com' });
    });
  });
});


import React, { useState, useContext, FormEvent } from 'react';
import { User, Lock, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import ToggleSwitch from '../components/ui/ToggleSwitch';
// FIX: Replaced namespace import for react-router-dom with a named import to resolve module export errors.
import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const LoginPage: React.FC = () => {
  const { login, theme, toggleTheme } = useContext(AppContext);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await login(identifier, password);
    if (error) {
      setError(error);
    }
    setIsLoading(false);
  };

  // Inline SVG for background to avoid extra file requests
  const backgroundSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 810">
      <path fill="#0A192F" d="M0 0h1440v810H0z"/>
      <path fill-opacity="0.1" fill="#00A8E8" d="M366 181h-24v24h24v-24zm-12 120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm5-137L226 72l-11 19 91 53zm-21 213l-91-53-11 19 91 53z M1082 625a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24z m108-84h-24v24h24v-24zm-12 120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm5-137l-91-53-11 19 91 53zm-21 213l-91-53-11 19 91 53z"/>
    </svg>
  `;
  const bgUrl = `url("data:image/svg+xml,${encodeURIComponent(backgroundSvg)}")`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundImage: bgUrl, backgroundSize: 'cover' }}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 items-center gap-8">
        <div className="text-center md:text-left text-white">
          <div className="flex justify-center md:justify-start items-center gap-4 mb-4">
            <div className="bg-white p-1 rounded-lg">
              <Logo width={48} height={48} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">KSEF</h1>
              <p className="text-gray-300">Kenya Science & Engineering Fair</p>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold mt-2">Online Platform</h2>
          <p className="text-gray-300 mt-2">Digitizing the future of science fairs in Kenya.</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white">Welcome Back</h3>
              <p className="text-gray-300">Please sign in to your account</p>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className="h-5 w-5 text-yellow-300" />
              <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} ariaLabel='Dark Mode Toggle' />
              <Moon className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-sm">{error}</p>}
            <div className="relative mb-4">
              <User className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Email or Phone Number"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full bg-white/20 text-white placeholder-gray-300 border-2 border-transparent focus:border-primary focus:ring-0 rounded-lg py-3 pl-12 pr-4 transition"
                required
              />
            </div>
            <div className="relative mb-4">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/20 text-white placeholder-gray-300 border-2 border-transparent focus:border-primary focus:ring-0 rounded-lg py-3 pl-12 pr-12 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <div className="text-right mb-6">
              <Link to="/forgot-password" className="text-sm font-semibold text-accent-green hover:underline">
                Forgot Password?
              </Link>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity duration-300 flex items-center justify-center" disabled={isLoading}>
              {isLoading ? <LoadingSpinner /> : 'LOG IN'}
            </button>
            <p className="text-center text-sm text-gray-300 mt-6">
              {/* FIX: Replaced ReactRouterDOM.Link with Link from named import. */}
              Don't have an account? <Link to="/signup" className="font-semibold text-accent-green hover:underline">Sign Up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState, useContext, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Mail, ArrowLeft, Sun, Moon } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ToggleSwitch from '../components/ui/ToggleSwitch';

const ForgotPasswordPage: React.FC = () => {
    const { theme, toggleTheme, sendPasswordResetEmail } = useContext(AppContext);
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        await sendPasswordResetEmail(email);
        setIsLoading(false);
        setIsSubmitted(true);
    };
    
    // Using the same background as login
    const backgroundSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 810">
        <path fill="#0A192F" d="M0 0h1440v810H0z"/>
        <path fill-opacity="0.1" fill="#00A8E8" d="M366 181h-24v24h24v-24zm-12 120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm5-137L226 72l-11 19 91 53zm-21 213l-91-53-11 19 91 53z M1082 625a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24z m108-84h-24v24h24v-24zm-12 120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-48 108a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm132-24a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm-24-120a12 12 0 1 1 0-24 12 12 0 0 1 0 24zm5-137l-91-53-11 19 91 53zm-21 213l-91-53-11 19 91 53z"/>
      </svg>
    `;
    const bgUrl = `url("data:image/svg+xml,${encodeURIComponent(backgroundSvg)}")`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundImage: bgUrl, backgroundSize: 'cover'}}>
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-2xl font-bold text-white">Forgot Password</h3>
                      <p className="text-gray-300">Enter your email to get a reset link.</p>
                  </div>
                   <div className="flex items-center space-x-2">
                      <Sun className="h-5 w-5 text-yellow-300" />
                      <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} ariaLabel='Dark Mode Toggle' />
                      <Moon className="h-5 w-5 text-gray-400" />
                  </div>
              </div>

              {isSubmitted ? (
                <div className="text-center">
                  <p className="bg-green-500/50 text-white p-3 rounded-lg text-sm mb-4">If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).</p>
                  <Link to="/login" className="font-semibold text-accent-green hover:underline flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4"/> Back to Login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                    <div className="relative mb-4">
                        <Mail className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-white/20 text-white placeholder-gray-300 border-2 border-transparent focus:border-primary focus:ring-0 rounded-lg py-3 pl-12 pr-4 transition"
                            required
                        />
                    </div>
                     <button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity duration-300 flex items-center justify-center" disabled={isLoading}>
                        {isLoading ? <LoadingSpinner /> : 'SEND RESET LINK'}
                    </button>
                    <p className="text-center text-sm text-gray-300 mt-6">
                        Remembered your password? <Link to="/login" className="font-semibold text-accent-green hover:underline">Log In</Link>
                    </p>
                    <p className="text-center text-xs text-gray-400 mt-4">
                        If you cannot access your email, please contact your administrator to have your password reset manually.
                    </p>
                </form>
              )}
          </div>
        </div>
      </div>
    );
};

export default ForgotPasswordPage;

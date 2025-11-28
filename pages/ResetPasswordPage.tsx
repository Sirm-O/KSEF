
import React, { useState, useContext, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Lock, Sun, Moon, KeyRound, Eye, EyeOff } from 'lucide-react';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const ResetPasswordPage: React.FC = () => {
    const { user, theme, toggleTheme, updatePassword, logout } = useContext(AppContext);
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // This effect ensures that only users who have arrived via the reset link
    // (and thus have a temporary session) can see this page.
    useEffect(() => {
        // We add a short delay to allow the async onAuthStateChange to set the user
        const timer = setTimeout(() => {
            if (!user) {
                navigate('/login');
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [user, navigate]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        const { error: updateError } = await updatePassword(newPassword);
        
        if (updateError) {
            setError(updateError);
        } else {
            setSuccess('Your password has been reset successfully. You will be logged out and can now log in with your new password.');
            setTimeout(async () => {
                await logout(); // Force logout to make them log in again.
                // The onAuthStateChange listener will handle redirecting to /login
            }, 4000);
        }
        setIsLoading(false);
    };
    
    // Background style
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
                            <h3 className="text-2xl font-bold text-white">Reset Your Password</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Sun className="h-5 w-5 text-yellow-300" />
                            <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} ariaLabel='Dark Mode Toggle' />
                            <Moon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                    {success ? (
                      <p className="bg-green-500/50 text-white p-3 rounded-lg text-sm">{success}</p>
                    ) : (
                      <form onSubmit={handleSubmit}>
                          {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-sm">{error}</p>}
                          <div className="relative mb-4">
                              <KeyRound className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                              <input
                                  type={showNewPassword ? 'text' : 'password'}
                                  placeholder="New Password (min 8 characters)"
                                  value={newPassword}
                                  onChange={e => setNewPassword(e.target.value)}
                                  className="w-full bg-white/20 text-white placeholder-gray-300 border-2 border-transparent focus:border-primary focus:ring-0 rounded-lg py-3 pl-12 pr-12 transition"
                                  required
                              />
                              <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                              >
                                  {showNewPassword ? <EyeOff /> : <Eye />}
                              </button>
                          </div>
                          <div className="relative mb-6">
                              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                              <input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  placeholder="Confirm New Password"
                                  value={confirmPassword}
                                  onChange={e => setConfirmPassword(e.target.value)}
                                  className="w-full bg-white/20 text-white placeholder-gray-300 border-2 border-transparent focus:border-primary focus:ring-0 rounded-lg py-3 pl-12 pr-12 transition"
                                  required
                              />
                              <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                              >
                                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                              </button>
                          </div>
                          <button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity duration-300 flex items-center justify-center" disabled={isLoading}>
                              {isLoading ? <LoadingSpinner /> : 'RESET PASSWORD'}
                          </button>
                      </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;

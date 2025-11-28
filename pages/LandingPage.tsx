import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import Button from '../components/ui/Button';
import { Sun, Moon } from 'lucide-react';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import Logo from '../components/ui/Logo';

const LandingPage: React.FC = () => {
    const { theme, toggleTheme, activeEdition } = useContext(AppContext);

    // Inline SVG for the decorative dot pattern
    const DotPattern = () => (
        <svg
          className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2"
          width="404"
          height="404"
          fill="none"
          viewBox="0 0 404 404"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="85737c0e-0916-41d7-917f-596dc7edfa27"
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="4" height="4" className="text-gray-200 dark:text-gray-700" fill="currentColor"></rect>
            </pattern>
          </defs>
          <rect width="404" height="404" fill="url(#85737c0e-0916-41d7-917f-596dc7edfa27)"></rect>
        </svg>
    );

    // Inline SVG for the main graphic
    const TechGraphic = () => (
        <svg className="w-full h-full" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: 'var(--color-primary-dark)', stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor: 'var(--color-primary)', stopOpacity:1}} />
                </linearGradient>
                <style>
                    {`
                        :root {
                            --color-primary: #00A8E8;
                            --color-primary-dark: #007EA7;
                            --color-secondary: #003459;
                            --color-accent-green: #64FFDA;
                        }
                        .dark:root {
                             --color-primary: #64FFDA;
                             --color-primary-dark: #00A8E8;
                        }
                    `}
                </style>
            </defs>
            <path d="M200,380 A180,180 0 1,1 200,20" stroke="url(#grad1)" strokeWidth="8" fill="none" strokeDasharray="10 10" style={{ animation: 'rotate 60s linear infinite' }} />
            <path d="M200,350 A150,150 0 1,1 200,50" stroke="url(#grad1)" strokeWidth="4" fill="none" strokeDasharray="5 5" style={{ animation: 'rotate-reverse 40s linear infinite' }} />
            <circle cx="200" cy="200" r="20" fill="var(--color-accent-green)" />
            
            <g className="text-primary-dark dark:text-primary">
                <circle cx="200" cy="20" r="10" fill="currentColor" />
                <circle cx="380" cy="200" r="10" fill="currentColor" />
                <circle cx="200" cy="380" r="10" fill="currentColor" />
                <circle cx="20" cy="200" r="10" fill="currentColor" />
                
                <line x1="215" y1="200" x2="365" y2="200" stroke="currentColor" strokeWidth="2" />
                <line x1="200" y1="215" x2="200" y2="365" stroke="currentColor" strokeWidth="2" />
                <line x1="35" y1="200" x2="185" y2="200" stroke="currentColor" strokeWidth="2" />
                <line x1="200" y1="35" x2="200" y2="185" stroke="currentColor" strokeWidth="2" />

                <text x="130" y="140" fontFamily="monospace" fontSize="16" fill="currentColor" className="opacity-70">01101011</text>
                <text x="250" y="270" fontFamily="monospace" fontSize="16" fill="currentColor" className="opacity-70">11001001</text>
            </g>
            {/* FIX: Encapsulated all CSS rules into a single template literal to prevent JSX parsing errors. */}
            <style>
                {`@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes rotate-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                svg path, svg line { transform-origin: center; }`}
            </style>
        </svg>
    );

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark flex flex-col overflow-hidden">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 p-4 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2">
                        <Logo width={40} height={40} />
                        <span className="font-bold text-lg hidden sm:block">KSEF</span>
                    </Link>
                    <div className="flex items-center space-x-2">
                        <Sun className="h-5 w-5 text-yellow-500" />
                        <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} ariaLabel="Toggle theme" />
                        <Moon className="h-5 w-5 text-gray-400" />
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto flex items-center p-4">
                <div className="grid lg:grid-cols-5 gap-16 items-center">
                    {/* Left Column: Text Content */}
                    <div className="lg:col-span-3 text-center lg:text-left z-10">
                        <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                            <h2 className="text-xl font-bold tracking-wider text-secondary dark:text-accent-green">
                                KENYA SCIENCE & ENGINEERING FAIR
                            </h2>
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-extrabold text-text-light dark:text-text-dark leading-tight">
                            Transforming Innovation with <span className="text-primary">Digital Tools</span>
                        </h1>
                        
                        <p className="mt-6 text-lg max-w-2xl mx-auto lg:mx-0 text-text-muted-light dark:text-text-muted-dark">
                            The official digital platform for KSEF, designed to streamline project submissions, judging, and administration across all competition levels—from Sub-County to the National stage.
                        </p>
                        
                        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <Link to="/login"><Button size="lg">Log In to Portal</Button></Link>
                            <Link to="/signup"><Button size="lg" variant="secondary">Sign Up as Patron</Button></Link>
                        </div>
                    </div>
                    
                    {/* Right Column: Graphic */}
                    <div className="relative hidden lg:block lg:col-span-2 h-96">
                        <DotPattern />
                        {/* The skewed background shape */}
                        <div className="absolute inset-y-0 -right-12 w-[120%] bg-secondary rounded-2xl transform -skew-x-12"></div>
                        
                        {/* The content inside, un-skewed */}
                        <div className="absolute inset-4 transform skew-x-12">
                            <div className="relative h-full w-full rounded-lg overflow-hidden bg-background-dark/50 p-6 flex items-center justify-center">
                                <TechGraphic />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Footer */}
            <footer className="w-full p-4 text-center text-sm text-text-muted-light dark:text-text-muted-dark z-[5]">
                <p>&copy; {new Date().getFullYear()} Ministry of Education | Kenya Science and Engineering Fair. All Rights Reserved.</p>
            </footer>
        </div>
    );
};

export default LandingPage;

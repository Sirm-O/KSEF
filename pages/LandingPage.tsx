import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import Button from '../components/ui/Button';
import { Sun, Moon, Lightbulb, TrendingUp, Briefcase, Rocket, Leaf, Users, Award, Brain, FileCheck, BarChart3, Calendar, MapPin, School, Shield, ChevronDown, Trophy } from 'lucide-react';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import Logo from '../components/ui/Logo';
import { supabase } from '../supabaseClient';
import { CompetitionLevel } from '../types';

const LandingPage: React.FC = () => {
    const { theme, toggleTheme, activeEdition, editions } = useContext(AppContext);

    // Statistics state
    const [stats, setStats] = useState({
        currentEdition: 0,
        totalProjects: 0,
        regions: 0,
        counties: 0,
        subCounties: 0,
        schools: 0,
    });

    // Previous edition winners state
    const [previousWinners, setPreviousWinners] = useState<{
        topSchool: { school: string; region: string; county: string; points: number } | null;
        topRegion: { name: string; points: number } | null;
        topCounty: { name: string; region: string; points: number } | null;
        nationalChampions: Array<{ title: string; school: string; category: string }>;
    }>({
        topSchool: null,
        topRegion: null,
        topCounty: null,
        nationalChampions: [],
    });

    useEffect(() => {
        fetchStatistics();
        fetchPreviousEditionWinners();
    }, [activeEdition]);

    const fetchStatistics = async () => {
        try {
            if (!activeEdition) return;

            // Fetch projects for current edition
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('region, county, sub_county, school')
                .eq('edition_id', activeEdition.id);

            if (projectsError) {
                console.error('Error fetching projects:', projectsError);
                return;
            }

            if (projects && projects.length > 0) {
                // Calculate unique counts
                const uniqueRegions = new Set(projects.map(p => p.region).filter(Boolean));
                const uniqueCounties = new Set(projects.map(p => p.county).filter(Boolean));
                const uniqueSubCounties = new Set(projects.map(p => p.sub_county).filter(Boolean));
                const uniqueSchools = new Set(projects.map(p => p.school).filter(Boolean));

                setStats({
                    currentEdition: activeEdition.year,
                    totalProjects: projects.length,
                    regions: uniqueRegions.size,
                    counties: uniqueCounties.size,
                    subCounties: uniqueSubCounties.size,
                    schools: uniqueSchools.size,
                });
            } else {
                // Default stats if no projects yet
                setStats({
                    currentEdition: activeEdition.year,
                    totalProjects: 0,
                    regions: 8, // Kenya has 8 regions typically
                    counties: 47,
                    subCounties: 0,
                    schools: 0,
                });
            }
        } catch (error) {
            console.error('Error in fetchStatistics:', error);
        }
    };

    const fetchPreviousEditionWinners = async () => {
        try {
            // Get the previous edition (not the current active one)
            const previousEdition = editions.find(e => !e.is_active && e.year === (activeEdition?.year || new Date().getFullYear()) - 1);

            if (!previousEdition) return;

            // Fetch projects from previous edition that reached National level
            const { data: nationalProjects, error } = await supabase
                .from('projects')
                .select('id, title, school, region, county, category, current_level')
                .eq('edition_id', previousEdition.id)
                .eq('current_level', CompetitionLevel.NATIONAL)
                .eq('is_eliminated', false);

            if (error || !nationalProjects || nationalProjects.length === 0) {
                return;
            }

            // Fetch assignments to calculate scores
            const projectIds = nationalProjects.map(p => p.id);
            const { data: assignments } = await supabase
                .from('judge_assignments')
                .select('project_id, score, status')
                .in('project_id', projectIds)
                .eq('competition_level', CompetitionLevel.NATIONAL)
                .eq('status', 'Completed');

            if (!assignments) return;

            // Calculate total scores for each project
            const projectScores = new Map<string, number>();
            assignments.forEach(assignment => {
                const current = projectScores.get(assignment.project_id) || 0;
                projectScores.set(assignment.project_id, current + (assignment.score || 0));
            });

            // Create project rankings
            const rankedProjects = nationalProjects
                .map(project => ({
                    ...project,
                    totalScore: projectScores.get(project.id) || 0,
                }))
                .sort((a, b) => b.totalScore - a.totalScore);

            // Get top 3 national champions
            const champions = rankedProjects.slice(0, 3).map(p => ({
                title: p.title,
                school: p.school,
                category: p.category,
            }));

            // Calculate school rankings by total points
            const schoolPoints = new Map<string, { school: string; region: string; county: string; totalScore: number }>();
            rankedProjects.forEach(project => {
                const key = `${project.school}|${project.region}|${project.county}`;
                const current = schoolPoints.get(key) || { school: project.school, region: project.region, county: project.county, totalScore: 0 };
                current.totalScore += project.totalScore;
                schoolPoints.set(key, current);
            });

            const topSchools = Array.from(schoolPoints.values()).sort((a, b) => b.totalScore - a.totalScore);
            const topSchool = topSchools.length > 0
                ? { school: topSchools[0].school, region: topSchools[0].region, county: topSchools[0].county, points: Math.round(topSchools[0].totalScore) }
                : null;

            // Calculate region rankings
            const regionPoints = new Map<string, number>();
            rankedProjects.forEach(project => {
                const current = regionPoints.get(project.region) || 0;
                regionPoints.set(project.region, current + project.totalScore);
            });

            const topRegions = Array.from(regionPoints.entries())
                .map(([name, points]) => ({ name, points }))
                .sort((a, b) => b.points - a.points);

            const topRegion = topRegions.length > 0
                ? { name: topRegions[0].name, points: Math.round(topRegions[0].points) }
                : null;

            // Calculate county rankings
            const countyPoints = new Map<string, { county: string; region: string; totalScore: number }>();
            rankedProjects.forEach(project => {
                const key = `${project.county}|${project.region}`;
                const current = countyPoints.get(key) || { county: project.county, region: project.region, totalScore: 0 };
                current.totalScore += project.totalScore;
                countyPoints.set(key, current);
            });

            const topCounties = Array.from(countyPoints.values()).sort((a, b) => b.totalScore - a.totalScore);
            const topCounty = topCounties.length > 0
                ? { name: topCounties[0].county, region: topCounties[0].region, points: Math.round(topCounties[0].totalScore) }
                : null;

            setPreviousWinners({
                topSchool,
                topRegion,
                topCounty,
                nationalChampions: champions,
            });

        } catch (error) {
            console.error('Error fetching previous edition winners:', error);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark overflow-hidden">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 z-50 border-b border-gray-200 dark:border-gray-800">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2">
                        <Logo width={40} height={40} />
                        <span className="font-bold text-lg hidden sm:block">KSEF</span>
                    </Link>
                    <div className="flex items-center space-x-6">
                        <nav className="hidden md:flex items-center space-x-6">
                            <a href="#about" className="hover:text-primary transition-colors">About</a>
                            <a href="#objectives" className="hover:text-primary transition-colors">Objectives</a>
                            <a href="#levels" className="hover:text-primary transition-colors">Competition</a>
                            <a href="#features" className="hover:text-primary transition-colors">Features</a>
                        </nav>
                        <div className="flex items-center space-x-2">
                            <Sun className="h-5 w-5 text-yellow-500" />
                            <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} ariaLabel="Toggle theme" />
                            <Moon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent-green/10 dark:from-primary/20 dark:via-secondary/10 dark:to-accent-green/20"></div>
                <div className="absolute inset-0 opacity-30">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <circle cx="20" cy="20" r="1" fill="currentColor" className="text-primary dark:text-accent-green" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                <div className="container mx-auto px-4 z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="text-center lg:text-left space-y-6 animate-fade-in">
                            <div className="inline-block">
                                <span className="px-4 py-2 bg-primary/10 dark:bg-accent-green/10 text-primary dark:text-accent-green rounded-full text-sm font-semibold border border-primary/20 dark:border-accent-green/20">
                                    {activeEdition ? `${activeEdition.name} • ${activeEdition.year}` : '61st Edition • 2025'}
                                </span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight">
                                Kenya Science &amp;
                                <span className="block text-primary dark:text-accent-green">Engineering Fair</span>
                            </h1>
                            <p className="text-xl md:text-2xl text-text-muted-light dark:text-text-muted-dark font-medium">
                                Science and Technology for actualization of Vision 2030
                            </p>
                            <p className="text-lg text-text-muted-light dark:text-text-muted-dark max-w-2xl">
                                The official digital platform for KSEF, operated under the <strong>Ministry of Education</strong>.
                                Empowering secondary school students to showcase innovative solutions that drive sustainable development and national prosperity.
                            </p>
                        </div>

                        {/* Hero Graphic */}
                        <div className="hidden lg:flex items-center justify-center">
                            <div className="relative w-full max-w-lg">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent-green rounded-full blur-3xl opacity-20 animate-pulse"></div>
                                <svg viewBox="0 0 400 400" className="w-full h-full relative z-10">
                                    <defs>
                                        <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style={{ stopColor: '#00A8E8' }} />
                                            <stop offset="100%" style={{ stopColor: '#64FFDA' }} />
                                        </linearGradient>
                                    </defs>
                                    {/* Orbiting circles */}
                                    <circle cx="200" cy="200" r="150" fill="none" stroke="url(#heroGrad)" strokeWidth="2" opacity="0.3" strokeDasharray="10 5" />
                                    <circle cx="200" cy="200" r="120" fill="none" stroke="url(#heroGrad)" strokeWidth="2" opacity="0.5" strokeDasharray="5 3">
                                        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="200" cy="200" r="90" fill="none" stroke="url(#heroGrad)" strokeWidth="2" opacity="0.7">
                                        <animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="20s" repeatCount="indefinite" />
                                    </circle>
                                    {/* Center symbol */}
                                    <circle cx="200" cy="200" r="50" fill="url(#heroGrad)" opacity="0.2" />
                                    <path d="M200,160 L200,180 M200,220 L200,240 M160,200 L180,200 M220,200 L240,200" stroke="url(#heroGrad)" strokeWidth="4" strokeLinecap="round" />
                                    <circle cx="200" cy="200" r="15" fill="url(#heroGrad)" />
                                    {/* Orbiting nodes */}
                                    <circle cx="200" cy="50" r="8" fill="#64FFDA">
                                        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="350" cy="200" r="8" fill="#00A8E8">
                                        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="200" cy="350" r="8" fill="#64FFDA">
                                        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
                                    </circle>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                    <ChevronDown className="w-8 h-8 text-primary dark:text-accent-green" strokeWidth={3} />
                </div>
            </section>

            {/* About KSEF Section */}
            <section id="about" className="py-20 bg-white dark:bg-gray-900 relative">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center space-y-6">
                        <h2 className="text-4xl md:text-5xl font-bold">About KSEF</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent-green mx-auto rounded-full"></div>
                        <p className="text-lg text-text-muted-light dark:text-text-muted-dark leading-relaxed">
                            The <strong>Kenya Science and Engineering Fair (KSEF)</strong>, formerly known as the Kenya Science Congress,
                            is celebrating its <strong>61st edition in 2025</strong>. Operating under the <strong>Ministry of Education</strong>,
                            KSEF has been at the forefront of nurturing scientific innovation and engineering excellence among secondary school students across Kenya.
                        </p>
                        <p className="text-lg text-text-muted-light dark:text-text-muted-dark leading-relaxed">
                            This prestigious annual event provides a platform for young innovators to showcase their groundbreaking projects,
                            compete at multiple levels, and contribute to Kenya's journey toward Vision 2030 through science and technology.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 pt-8">
                            <div className="p-4 md:p-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl border border-primary/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.currentEdition || new Date().getFullYear()}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Current Edition</div>
                            </div>
                            <div className="p-4 md:p-6 bg-gradient-to-br from-accent-green/10 to-accent-green/5 dark:from-accent-green/20 dark:to-accent-green/10 rounded-xl border border-accent-green/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.totalProjects}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Total Projects</div>
                            </div>
                            <div className="p-4 md:p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 dark:from-secondary/20 dark:to-secondary/10 rounded-xl border border-secondary/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.regions}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Regions</div>
                            </div>
                            <div className="p-4 md:p-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl border border-primary/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.counties}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Counties</div>
                            </div>
                            <div className="p-4 md:p-6 bg-gradient-to-br from-accent-green/10 to-accent-green/5 dark:from-accent-green/20 dark:to-accent-green/10 rounded-xl border border-accent-green/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.subCounties}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Sub-Counties</div>
                            </div>
                            <div className="p-4 md:p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 dark:from-secondary/20 dark:to-secondary/10 rounded-xl border border-secondary/20">
                                <div className="text-3xl md:text-4xl font-bold text-primary dark:text-accent-green">{stats.schools}</div>
                                <div className="text-xs md:text-sm font-semibold mt-2">Schools</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Previous Edition Performance Section */}
            {(previousWinners.topSchool || previousWinners.nationalChampions.length > 0) && (
                <section className="py-20 bg-gradient-to-br from-secondary/95 to-primary/95 dark:from-secondary dark:to-primary text-white relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-10">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="trophy-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                                    <circle cx="40" cy="40" r="2" fill="currentColor" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#trophy-pattern)" />
                        </svg>
                    </div>

                    <div className="container mx-auto px-4 relative z-10">
                        <div className="text-center space-y-4 mb-16">
                            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                                <Trophy className="w-5 h-5" />
                                <span className="font-semibold">Previous Edition Highlights</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold">Champions of Excellence</h2>
                            <p className="text-lg opacity-90 max-w-2xl mx-auto">
                                Celebrating the outstanding achievements from the previous KSEF edition
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {/* Top School */}
                            {previousWinners.topSchool && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-accent-green rounded-full flex items-center justify-center">
                                            <School className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-75">Top School</div>
                                            <div className="font-bold text-lg">Overall Winner</div>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{previousWinners.topSchool.school}</h3>
                                    <p className="text-sm opacity-75">{previousWinners.topSchool.county}, {previousWinners.topSchool.region}</p>
                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <div className="text-2xl font-bold text-accent-green">{previousWinners.topSchool.points}</div>
                                        <div className="text-xs opacity-75">Total Points</div>
                                    </div>
                                </div>
                            )}

                            {/* Top Region */}
                            {previousWinners.topRegion && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                                            <MapPin className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-75">Top Region</div>
                                            <div className="font-bold text-lg">Regional Leader</div>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{previousWinners.topRegion.name}</h3>
                                    <p className="text-sm opacity-75">Highest performing region</p>
                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <div className="text-2xl font-bold text-accent-green">{previousWinners.topRegion.points}</div>
                                        <div className="text-xs opacity-75">Total Points</div>
                                    </div>
                                </div>
                            )}

                            {/* Top County */}
                            {previousWinners.topCounty && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                                            <MapPin className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-xs opacity-75">Top County</div>
                                            <div className="font-bold text-lg">County Champion</div>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{previousWinners.topCounty.name}</h3>
                                    <p className="text-sm opacity-75">{previousWinners.topCounty.region}</p>
                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <div className="text-2xl font-bold text-accent-green">{previousWinners.topCounty.points}</div>
                                        <div className="text-xs opacity-75">Total Points</div>
                                    </div>
                                </div>
                            )}

                            {/* 61 Years Achievement */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-accent-green rounded-full flex items-center justify-center">
                                        <Award className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-75">Legacy</div>
                                        <div className="font-bold text-lg">Excellence</div>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold mb-2">61 Years</h3>
                                <p className="text-sm opacity-75">of nurturing innovation</p>
                                <div className="mt-4 pt-4 border-t border-white/20">
                                    <div className="text-2xl font-bold text-accent-green">1964-2025</div>
                                    <div className="text-xs opacity-75">Continuous Impact</div>
                                </div>
                            </div>
                        </div>

                        {/* National Champions */}
                        {previousWinners.nationalChampions.length > 0 && (
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                    <Trophy className="w-6 h-6 text-accent-green" />
                                    National Champions
                                </h3>
                                <div className="grid md:grid-cols-3 gap-6">
                                    {previousWinners.nationalChampions.map((champion, index) => (
                                        <div key={index} className="bg-white/10 rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-accent-green rounded-full flex items-center justify-center font-bold text-lg">
                                                    {index + 1}
                                                </div>
                                                <div className="text-xs opacity-75 uppercase tracking-wide">{champion.category}</div>
                                            </div>
                                            <h4 className="font-bold text-lg mb-2 line-clamp-2">{champion.title}</h4>
                                            <p className="text-sm opacity-75">{champion.school}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Objectives Section */}
            <section id="objectives" className="py-20 bg-gradient-to-br from-background-light to-gray-50 dark:from-background-dark dark:to-gray-900">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold">Our Objectives</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent-green mx-auto rounded-full"></div>
                        <p className="text-lg text-text-muted-light dark:text-text-muted-dark max-w-2xl mx-auto">
                            KSEF is committed to driving innovation and national development through science and engineering education
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {/* Objective 1 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-primary/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Lightbulb className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Innovation Showcase</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Provide a platform for secondary school students to showcase and endorse innovative solutions to real-world challenges.
                            </p>
                        </div>

                        {/* Objective 2 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-accent-green/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-accent-green to-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Leaf className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Sustainable Development</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Promote sustainable development through science and technology, aligning with Kenya's Vision 2030 goals.
                            </p>
                        </div>

                        {/* Objective 3 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-primary/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Briefcase className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Employment Opportunities</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Create pathways for employment and career development in STEM fields for Kenyan youth.
                            </p>
                        </div>

                        {/* Objective 4 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-accent-green/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent-green rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Rocket className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Foster Entrepreneurship</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Nurture entrepreneurial mindsets and skills, empowering students to transform innovations into viable businesses.
                            </p>
                        </div>

                        {/* Objective 5 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-primary/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary-dark to-secondary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <TrendingUp className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">National Prosperity</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Contribute to Kenya's economic growth and prosperity through scientific innovation and technological advancement.
                            </p>
                        </div>

                        {/* Objective 6 */}
                        <div className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-transparent hover:border-accent-green/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-accent-green to-primary-dark rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Research Excellence</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                Train students, teachers, and judges in research methodologies, fostering a culture of scientific inquiry.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Competition Levels Section */}
            <section id="levels" className="py-20 bg-white dark:bg-gray-900">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold">Competition Levels</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent-green mx-auto rounded-full"></div>
                        <p className="text-lg text-text-muted-light dark:text-text-muted-dark max-w-2xl mx-auto">
                            Projects progress through four competitive levels, with top performers advancing to represent their regions
                        </p>
                    </div>

                    <div className="max-w-5xl mx-auto">
                        <div className="relative">
                            {/* Vertical connecting line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent-green to-primary transform -translate-x-1/2 hidden md:block"></div>

                            {/* Level 1: Sub-County */}
                            <div className="relative mb-12">
                                <div className="md:grid md:grid-cols-2 gap-8 items-center">
                                    <div className="md:text-right space-y-3 mb-4 md:mb-0">
                                        <h3 className="text-2xl font-bold text-primary dark:text-accent-green">Sub-County Fair</h3>
                                        <p className="text-text-muted-light dark:text-text-muted-dark">
                                            The journey begins at the grassroots level. Schools within each sub-county present their projects to local judges.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-start">
                                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10 relative">
                                            1
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Level 2: County */}
                            <div className="relative mb-12">
                                <div className="md:grid md:grid-cols-2 gap-8 items-center">
                                    <div className="md:order-2 space-y-3 mb-4 md:mb-0">
                                        <h3 className="text-2xl font-bold text-primary dark:text-accent-green">County Fair</h3>
                                        <p className="text-text-muted-light dark:text-text-muted-dark">
                                            Top qualifiers from sub-counties compete at the county level, showcasing the best innovations from each county.
                                        </p>
                                    </div>
                                    <div className="md:order-1 flex items-center justify-end">
                                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent-green rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10 relative">
                                            2
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Level 3: Regional */}
                            <div className="relative mb-12">
                                <div className="md:grid md:grid-cols-2 gap-8 items-center">
                                    <div className="md:text-right space-y-3 mb-4 md:mb-0">
                                        <h3 className="text-2xl font-bold text-primary dark:text-accent-green">Regional Fair</h3>
                                        <p className="text-text-muted-light dark:text-text-muted-dark">
                                            County champions advance to compete in regional competitions, representing larger geographic areas.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-start">
                                        <div className="w-16 h-16 bg-gradient-to-br from-accent-green to-primary rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10 relative">
                                            3
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Level 4: National */}
                            <div className="relative">
                                <div className="md:grid md:grid-cols-2 gap-8 items-center">
                                    <div className="md:order-2 space-y-3 mb-4 md:mb-0">
                                        <h3 className="text-2xl font-bold text-primary dark:text-accent-green">National Fair</h3>
                                        <p className="text-text-muted-light dark:text-text-muted-dark">
                                            The pinnacle of KSEF! Regional winners compete for national recognition, scholarships, and international opportunities.
                                        </p>
                                        <div className="inline-flex items-center gap-2 text-sm bg-primary/10 dark:bg-accent-green/10 px-4 py-2 rounded-full">
                                            <Award className="w-4 h-4" />
                                            <span className="font-semibold">2025: April 5-12, Kangaru High School, Embu County</span>
                                        </div>
                                    </div>
                                    <div className="md:order-1 flex items-center justify-end">
                                        <div className="w-16 h-16 bg-gradient-to-br from-accent-green to-primary-dark rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10 relative ring-4 ring-accent-green/30">
                                            4
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Platform Features Section */}
            <section id="features" className="py-20 bg-gradient-to-br from-background-light to-gray-50 dark:from-background-dark dark:to-gray-900">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold">Digital Platform Features</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent-green mx-auto rounded-full"></div>
                        <p className="text-lg text-text-muted-light dark:text-text-muted-dark max-w-2xl mx-auto">
                            A comprehensive digital ecosystem that streamlines every aspect of the competition
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                                <FileCheck className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Digital Submission</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Seamless online project registration with abstract upload and student details management.
                            </p>
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-accent-green/10 dark:bg-accent-green/20 rounded-lg flex items-center justify-center mb-4">
                                <Brain className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">AI Analysis</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Advanced AI-powered abstract analysis for plagiarism detection and title/category suggestions.
                            </p>
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-secondary/10 dark:bg-secondary/20 rounded-lg flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Automated Judging</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Structured judging workflow with conflict of interest detection and AI-assisted feedback.
                            </p>
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                                <BarChart3 className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Real-time Analytics</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Live leaderboards, performance tracking, and comprehensive statistical reports for all levels.
                            </p>
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-accent-green/10 dark:bg-accent-green/20 rounded-lg flex items-center justify-center mb-4">
                                <Award className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Certificate Generation</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Automated certificate creation for students, patrons, and schools with professional templates.
                            </p>
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-secondary/10 dark:bg-secondary/20 rounded-lg flex items-center justify-center mb-4">
                                <Shield className="w-6 h-6 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Multi-level Management</h3>
                            <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                                Hierarchical administration system managing competitions from sub-county to national level.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stakeholders Section */}
            <section id="stakeholders" className="py-20 bg-white dark:bg-gray-900">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold">Who We Serve</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent-green mx-auto rounded-full"></div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                        <div className="text-center space-y-4 p-6 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-2xl">
                            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                <School className="w-10 h-10 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-xl font-bold">Patrons</h3>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Teachers and mentors who guide students through project development and registration.
                            </p>
                        </div>

                        <div className="text-center space-y-4 p-6 bg-gradient-to-br from-accent-green/5 to-accent-green/10 dark:from-accent-green/10 dark:to-accent-green/20 rounded-2xl">
                            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                <Award className="w-10 h-10 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-xl font-bold">Judges</h3>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Expert evaluators who assess projects fairly and provide constructive feedback to students.
                            </p>
                        </div>

                        <div className="text-center space-y-4 p-6 bg-gradient-to-br from-secondary/5 to-secondary/10 dark:from-secondary/10 dark:to-secondary/20 rounded-2xl">
                            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                <Users className="w-10 h-10 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-xl font-bold">Coordinators</h3>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Chief judges who oversee judging panels and resolve scoring conflicts and disputes.
                            </p>
                        </div>

                        <div className="text-center space-y-4 p-6 bg-gradient-to-br from-primary/5 to-accent-green/10 dark:from-primary/10 dark:to-accent-green/20 rounded-2xl">
                            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                <Shield className="w-10 h-10 text-primary dark:text-accent-green" />
                            </div>
                            <h3 className="text-xl font-bold">Administrators</h3>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Officials managing competitions at sub-county, county, regional, and national levels.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Key Dates Section */}
            <section className="py-20 bg-gradient-to-br from-primary to-secondary text-white">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                        <div className="inline-flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full backdrop-blur-sm">
                            <Calendar className="w-6 h-6" />
                            <span className="font-semibold text-lg">2025 National Fair</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold">Mark Your Calendar</h2>
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8 pt-8">
                            <div className="text-center">
                                <div className="text-6xl font-bold">5-12</div>
                                <div className="text-xl mt-2 opacity-90">April 2025</div>
                            </div>
                            <div className="hidden md:block w-px h-20 bg-white/30"></div>
                            <div className="text-center md:text-left">
                                <div className="flex items-center gap-2 text-xl font-semibold mb-2">
                                    <MapPin className="w-5 h-5" />
                                    Kangaru High School
                                </div>
                                <div className="text-lg opacity-90">Embu County, Kenya</div>
                            </div>
                        </div>
                        <p className="text-lg opacity-90 max-w-2xl mx-auto pt-4">
                            Join us for the 61st edition of KSEF, where Kenya's brightest young minds will showcase innovations
                            driving <strong>Science and Technology for actualization of Vision 2030</strong>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Call to Action Section */}
            <section className="py-20 bg-white dark:bg-gray-900">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                        <h2 className="text-4xl md:text-5xl font-bold">Ready to Get Started?</h2>
                        <p className="text-xl text-text-muted-light dark:text-text-muted-dark">
                            Whether you're a teacher registering projects, a judge evaluating innovations,
                            or an administrator managing competitions, our platform has everything you need.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <Link to="/login">
                                <Button size="lg" className="w-full sm:w-auto">Log In to Portal</Button>
                            </Link>
                            <Link to="/signup">
                                <Button size="lg" variant="secondary" className="w-full sm:w-auto">Sign Up as Patron</Button>
                            </Link>
                        </div>
                        <div className="pt-8">
                            <a
                                href="/USER_MANUAL.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-primary dark:text-accent-green hover:underline font-semibold"
                            >
                                <FileCheck className="w-5 h-5" />
                                Download User Manual
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-secondary dark:bg-gray-950 text-white py-12">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Logo width={40} height={40} />
                                <span className="font-bold text-xl">KSEF</span>
                            </div>
                            <p className="text-sm opacity-80">
                                Kenya Science and Engineering Fair - Empowering innovation for Vision 2030
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Quick Links</h4>
                            <ul className="space-y-2 text-sm opacity-80">
                                <li><a href="#about" className="hover:text-accent-green transition-colors">About KSEF</a></li>
                                <li><a href="#objectives" className="hover:text-accent-green transition-colors">Objectives</a></li>
                                <li><a href="#levels" className="hover:text-accent-green transition-colors">Competition Levels</a></li>
                                <li><a href="#features" className="hover:text-accent-green transition-colors">Platform Features</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Resources</h4>
                            <ul className="space-y-2 text-sm opacity-80">
                                <li><a href="/USER_MANUAL.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-accent-green transition-colors">User Manual</a></li>
                                <li><Link to="/login" className="hover:text-accent-green transition-colors">Login</Link></li>
                                <li><Link to="/signup" className="hover:text-accent-green transition-colors">Sign Up</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Contact</h4>
                            <ul className="space-y-2 text-sm opacity-80">
                                <li>Ministry of Education</li>
                                <li>Republic of Kenya</li>
                                <li className="pt-2">
                                    <a href="mailto:info@ksef.go.ke" className="hover:text-accent-green transition-colors">
                                        info@ksef.go.ke
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8 text-center text-sm opacity-80">
                        <p>&copy; {new Date().getFullYear()} Ministry of Education | Kenya Science and Engineering Fair. All Rights Reserved.</p>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 1s ease-out;
                }

                html {
                    scroll-behavior: smooth;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;

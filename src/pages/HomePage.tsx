import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Compass,
  Download,
  Film,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Menu,
  Monitor,
  Palette,
  Play,
  PlaySquare,
  Plus,
  Radio,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Square,
  Volume2,
  X,
  Youtube,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { useAuth } from '../auth/AuthContext';
import { useStudio } from '../context/StudioContext';
import { UserAccountDropdown } from '../components/UserAccountDropdown';

export function HomePage() {
  const { navigate } = useRouter();
  const { isGuest, profile, isConfigured, signOut } = useAuth();
  const { setWizardOpen, setAccountModalOpen } = useStudio();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'field' | 'quiz' | 'preview' | 'export'>('field');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleStartCreating = () => {
    navigate('/dashboard');
  };

  const handleOpenWizard = () => {
    setWizardOpen(true);
    navigate('/dashboard');
  };

  const faqs = [
    {
      q: 'What browser and hardware do I need to run Cricket Creator Studio?',
      a: 'The studio runs entirely in modern Chromium-based desktop browsers (Google Chrome, Microsoft Edge, Brave, or Chromium) to utilize hardware-accelerated WebCodecs for direct H.264 MP4 video encoding. No heavy video editing software is required.',
    },
    {
      q: 'Can I publish both 16:9 YouTube videos and 9:16 Shorts from one project?',
      a: 'Yes. Author your episode content once, and the built-in safe-area layout engine dynamically adapts scoreboards, question cards, countdown timers, and fielding graphics to fit 16:9 Landscape or 9:16 YouTube Shorts framing without clipping.',
    },
    {
      q: 'How does the Bulk Question Importer work?',
      a: 'You can paste multi-line quiz blocks from text notes or upload standard CSV and JSON files. The parser automatically validates 4 options per question, correct answer markers, difficulty ratings, and customizable 3s–30s countdown timers.',
    },
    {
      q: 'Where are my projects and media stored?',
      a: 'Projects are saved locally in your browser storage (localStorage for episode structure, IndexedDB for audio files and custom channel logos). You can also export portable .zip project packages for backup and migration.',
    },
    {
      q: 'Do I have to sign in with Google to use the platform?',
      a: 'No. Cricket Creator Studio includes an offline Guest Mode by default. You can create projects, design tactical fields, and export videos immediately without an account. Google Sign-In is available for cloud identity and upcoming YouTube direct publishing.',
    },
    {
      q: 'How does the 1-Click Auto Episode Builder work?',
      a: 'Once your trivia bank is set, clicking "Auto Build Episode" automatically calculates the synchronized timeline: generating intro bumpers, question cards, audible countdown ticks, answer reveal chimes, explanation cards, and outro CTAs in under 1 second.',
    },
  ];

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#080E1A] text-slate-100 flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* ---------------- NAVIGATION HEADER ---------------- */}
      <header className="sticky top-0 z-40 w-full max-w-[100vw] bg-[#080E1A]/90 backdrop-blur-md border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] flex items-center justify-center font-display font-bold text-sm shadow-md shadow-[#D4AF37]/15 group-hover:scale-105 transition-transform">
              CC
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-base tracking-tight text-slate-100 group-hover:text-amber-300 transition-colors">
                Cricket Creator Studio
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider -mt-1 hidden sm:block">
                BROADCAST VIDEO PLATFORM
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#features" className="hover:text-amber-400 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-amber-400 transition-colors">
              How It Works
            </a>
            <a href="#field-designer" className="hover:text-amber-400 transition-colors">
              Tactical Field
            </a>
            <a href="#quiz-builder" className="hover:text-amber-400 transition-colors">
              Quiz Automation
            </a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">
              FAQ
            </a>
            <Link to="/dashboard" className="text-slate-200 hover:text-amber-300 transition-colors">
              Dashboard
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <UserAccountDropdown onOpenSettings={() => setAccountModalOpen(true)} />

            <button
              type="button"
              onClick={handleStartCreating}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20 transition-all active:scale-[0.98]"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-[#0C1426] px-4 pt-3 pb-5 space-y-3 animate-fade-in w-full max-w-full overflow-hidden">
            <div className="flex flex-col space-y-1 text-sm font-medium text-slate-200">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center rounded-lg hover:bg-[#131E38] transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center rounded-lg hover:bg-[#131E38] transition-colors"
              >
                How It Works
              </a>
              <a
                href="#field-designer"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center rounded-lg hover:bg-[#131E38] transition-colors"
              >
                Tactical Field Designer
              </a>
              <a
                href="#quiz-builder"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center rounded-lg hover:bg-[#131E38] transition-colors"
              >
                Quiz Automation
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center rounded-lg hover:bg-[#131E38] transition-colors"
              >
                FAQ
              </a>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 min-h-[44px] flex items-center justify-between rounded-lg text-amber-300 hover:bg-[#131E38] transition-colors"
              >
                <span>Creator Dashboard</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              {!isGuest && profile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAccountModalOpen(true);
                    }}
                    className="w-full min-h-[44px] rounded-lg bg-[#131E38] text-slate-200 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-[#D4AF37]" />
                    <span>Account Settings ({profile.name})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full min-h-[44px] rounded-lg bg-red-950/40 border border-red-700/50 text-red-200 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-[#131E38] text-slate-200 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-[#D4AF37]" />
                  <span>Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleStartCreating();
                }}
                className="w-full min-h-[44px] rounded-lg bg-[#D4AF37] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-2"
              >
                <span>Launch Creator Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ---------------- 1. HERO SECTION ---------------- */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-radial from-[#121E3B] via-[#080E1A] to-[#080E1A]">
        {/* Decorative Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#16233F] border border-[#D4AF37]/35 text-[#F4D57A] text-xs font-medium mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cricket Video Production & Tactical Diagram Studio</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
            Create Smarter <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4D57A] via-[#D4AF37] to-[#E2BE48]">
              Cricket Videos.
            </span>
          </h1>

          {/* Supporting text */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Build Cricket IQ quizzes, tactical field animations, branded episodes and YouTube-ready videos from one
            powerful creator studio.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleStartCreating}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/25 transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              <span>Start Creating</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#product-preview"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Explore Features</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="p-3 rounded-lg bg-[#0C1426]/70 border border-slate-800">
              <div className="text-xl font-display font-bold text-[#D4AF37]">23 Presets</div>
              <div className="text-xs text-slate-400 mt-0.5">Tactical fielding diagrams</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0C1426]/70 border border-slate-800">
              <div className="text-xl font-display font-bold text-[#D4AF37]">30-100 Qs</div>
              <div className="text-xs text-slate-400 mt-0.5">Automated quiz pacing</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0C1426]/70 border border-slate-800">
              <div className="text-xl font-display font-bold text-[#D4AF37]">16:9 & 9:16</div>
              <div className="text-xs text-slate-400 mt-0.5">Dual YouTube & Shorts masters</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0C1426]/70 border border-slate-800">
              <div className="text-xl font-display font-bold text-[#D4AF37]">100% In-Browser</div>
              <div className="text-xs text-slate-400 mt-0.5">WebCodecs MP4 rendering</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 2. PRODUCT PREVIEW SECTION ---------------- */}
      <section id="product-preview" className="py-16 md:py-24 bg-[#0A1120] border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
              One Workspace. Unlimited Cricket Content.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Inspect the real working tools built directly into the studio.
            </p>

            {/* Interactive Preview Tabs */}
            <div className="mt-6 inline-flex p-1 rounded-xl bg-[#080E1A] border border-slate-800 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActivePreviewTab('field')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activePreviewTab === 'field'
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Field Designer</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('quiz')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activePreviewTab === 'quiz'
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Quiz Builder</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('preview')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activePreviewTab === 'preview'
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlaySquare className="w-3.5 h-3.5" />
                <span>Multi-Aspect Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('export')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activePreviewTab === 'export'
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>Video Exporter</span>
              </button>
            </div>
          </div>

          {/* Interactive Mockup Container */}
          <div className="rounded-2xl bg-[#080E1A] border border-slate-700/80 shadow-2xl overflow-hidden">
            {/* Top Bar Chrome */}
            <div className="h-10 px-4 bg-[#0C1426] border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-300">
                  Cricket Creator Studio — Episode Master
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-[#D4AF37]">16:9 / 9:16 Adaptive</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px]">
                  LIVE READY
                </span>
              </div>
            </div>

            {/* Content Area Based on Tab */}
            <div className="p-4 sm:p-6 md:p-8 min-h-[380px] flex items-center justify-center">
              {activePreviewTab === 'field' && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-4 text-left">
                    <span className="px-2 py-1 rounded bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-mono font-semibold">
                      TACTICAL FIELDING ENGINE
                    </span>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                      23 Formations & Curved Ball Trajectories
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Toggle RHB/LHB handedness, reposition all 11 fielders with coordinate precision, set 30-yard
                      circles, and animate curved delivery and shot paths directly on the diagram.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Powerplay Attack, Death Overs, and Spin Trap presets</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Yorkers, Outswingers, Cover Drives, and Six dismissals</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Instant SVG overlay behind countdown quiz cards</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0A1120] border border-slate-700/80 p-4 aspect-[4/3] flex items-center justify-center relative overflow-hidden group">
                    <div className="w-full h-full rounded-lg bg-[#0F291E] border border-emerald-800/60 flex items-center justify-center relative">
                      {/* Oval boundary */}
                      <div className="w-[88%] h-[88%] rounded-full border border-white/30 flex items-center justify-center relative">
                        {/* 30-yard circle */}
                        <div className="w-[60%] h-[60%] rounded-full border border-dashed border-white/25 flex items-center justify-center">
                          {/* Pitch */}
                          <div className="w-8 h-20 bg-[#D4A373]/90 rounded-sm relative flex flex-col justify-between items-center py-1">
                            <span className="w-4 h-0.5 bg-white" />
                            <span className="w-4 h-0.5 bg-white" />
                          </div>
                        </div>

                        {/* Simulated Fielders */}
                        <div className="absolute top-8 left-12 w-5 h-5 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[9px] flex items-center justify-center shadow">
                          SL
                        </div>
                        <div className="absolute top-10 right-16 w-5 h-5 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[9px] flex items-center justify-center shadow">
                          PT
                        </div>
                        <div className="absolute bottom-8 left-16 w-5 h-5 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[9px] flex items-center justify-center shadow">
                          MD
                        </div>
                        <div className="absolute bottom-10 right-20 w-5 h-5 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[9px] flex items-center justify-center shadow">
                          CO
                        </div>
                      </div>

                      {/* Pill Badge */}
                      <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-slate-700 text-[10px] text-slate-300 font-mono">
                        Preset: Death Overs Boundary Lock
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'quiz' && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-4 text-left">
                    <span className="px-2 py-1 rounded bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-mono font-semibold">
                      RAPID TRIVIA AUTOMATION
                    </span>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                      Paste Text, CSV or JSON Question Banks
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Import up to 100 cricket questions in seconds. Set per-question countdowns, correct answer
                      indicators, difficulty tags, and explanatory callouts.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Validation on every line to prevent malformed rows</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>1-Click Auto Episode Builder generates full audio-synced timeline</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0A1120] border border-slate-700/80 p-5 space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[#D4AF37]">QUESTION #03 OF 30</span>
                      <span className="px-2 py-0.5 rounded bg-[#131E38] text-[10px] text-amber-300">IPL Trivia</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      Who holds the record for the fastest century in IPL history (30 balls)?
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded bg-[#131E38] border border-slate-700 text-slate-300">
                        A: AB de Villiers
                      </div>
                      <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 font-bold">
                        B: Chris Gayle (30b)
                      </div>
                      <div className="p-2 rounded bg-[#131E38] border border-slate-700 text-slate-300">
                        C: Yusuf Pathan
                      </div>
                      <div className="p-2 rounded bg-[#131E38] border border-slate-700 text-slate-300">
                        D: David Miller
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#080E1A] border border-slate-800 text-[11px] text-slate-400">
                      Explanation: Chris Gayle scored 175* off 66 balls against PWI in 2013, reaching his ton in 30 balls.
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'preview' && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-4 text-left">
                    <span className="px-2 py-1 rounded bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-mono font-semibold">
                      DUAL-FORMAT BROADCAST
                    </span>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                      16:9 Landscape & 9:16 Shorts
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Preview your episode in 16:9 widescreen or flip instantly to 9:16 vertical Shorts. Broadcast safe
                      areas guarantee text and countdowns never clip beneath platform UI overlays.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Action Safe and Title Safe broadcast margins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>0.25x to 2.0x playback speed scrubbing</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    {/* 16:9 Mockup */}
                    <div className="w-48 aspect-video rounded-lg bg-[#0C1426] border border-slate-700 p-2 flex flex-col justify-between shadow-lg">
                      <div className="flex items-center justify-between text-[9px] text-[#D4AF37]">
                        <span>16:9 YouTube</span>
                        <Monitor className="w-3 h-3" />
                      </div>
                      <div className="text-center font-bold text-xs text-white">Widescreen Master</div>
                      <div className="h-1 bg-amber-400 rounded-full w-2/3 mx-auto" />
                    </div>

                    {/* 9:16 Mockup */}
                    <div className="w-24 aspect-[9/16] rounded-lg bg-[#0C1426] border border-[#D4AF37]/70 p-2 flex flex-col justify-between shadow-lg">
                      <div className="flex items-center justify-between text-[8px] text-[#D4AF37]">
                        <span>9:16</span>
                        <Smartphone className="w-3 h-3" />
                      </div>
                      <div className="text-center font-bold text-[10px] text-white">Shorts</div>
                      <div className="h-1 bg-amber-400 rounded-full w-full" />
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'export' && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-4 text-left">
                    <span className="px-2 py-1 rounded bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-mono font-semibold">
                      IN-BROWSER WEBCODECS RENDER
                    </span>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                      Segmented Checkpoint Recovery
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Render multi-minute 1080p videos directly from your browser. Our segmented architecture caches
                      progress in chunks, allowing interrupted exports to resume seamlessly without restarting.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>H.264 High Profile + AAC 48 kHz stereo normalization</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Preflight readiness checker prevents failed exports</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0A1120] border border-slate-700/80 p-5 space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">Segmented Render Progress</span>
                      <span className="font-mono text-emerald-400">100% COMPLETE</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#D4AF37] rounded-full w-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1 font-mono">
                      <div>Segments: 3/3 Verified</div>
                      <div>Duration: 60.0s</div>
                      <div>FPS: 30 fps</div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-300">cricket-iq-demo-16x9.mp4</span>
                      <span className="text-emerald-400 font-semibold">Ready to Download</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 3. KEY FEATURES ---------------- */}
      <section id="features" className="py-20 bg-[#080E1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
              Production Powerhouse
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mt-2">
              Everything Needed to Run a Cricket YouTube Channel
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Deterministic, template-driven tools created specifically for cricket creators and tactical analysts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Interactive Cricket Field</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                23 fielding presets, 23 trajectory animations, RHB/LHB batter handedness switch, 30-yard circle, and
                draggable fielder markers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Bulk Question Importer</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Paste raw trivia text or upload CSV/JSON files. Line-by-line format validator with 3 merge options and
                custom countdown timers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">1-Click Auto Episode Builder</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Reads your question bank and auto-generates multi-track timelines with audio cues, countdown ticks, and
                reveal chimes instantly.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Brand Kit & Broadcast Overlays</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Customize brand colors, watermark, handle, monogram or uploaded logo. Compose score bugs, lower thirds,
                and 720p thumbnails.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Procedural SFX & Captions</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Normalized broadcast SFX engine (-1 dBFS peak), countdown audio generator, custom voiceover track
                mixing, and auto-timed .srt export.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 hover:border-[#D4AF37]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Segmented MP4 Export</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                WebCodecs video encoder splits long exports into verified segments. Interrupted renders can be resumed
                without losing progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 4. HOW IT WORKS ---------------- */}
      <section id="how-it-works" className="py-20 bg-[#0A1120] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
              Creator Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mt-2">
              From Concept to Published Video in 4 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-[#080E1A] border border-slate-800 relative">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] font-bold text-sm flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Create a Project</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Launch the 5-step Project Wizard. Select episode format (Quiz, Tactical Analysis, Explainer), aspect
                ratio, and brand style.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-[#080E1A] border border-slate-800 relative">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] font-bold text-sm flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Build Content</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Paste trivia questions, set per-question countdowns (3s–30s), configure tactical fielding formations,
                and scrub delivery trajectories.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-[#080E1A] border border-slate-800 relative">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] font-bold text-sm flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Customize & Preview</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Apply your channel watermark, upload custom audio narration, and preview live in 16:9 or 9:16 with
                broadcast safe-area guides.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-[#080E1A] border border-slate-800 relative">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] font-bold text-sm flex items-center justify-center mb-4">
                4
              </div>
              <h3 className="text-base font-display font-bold text-slate-100">Export Your Video</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Run preflight readiness checks, render MP4 master files directly in your browser, and copy pre-formatted
                YouTube chapters & tags.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 5. QUIZ BUILDER SHOWCASE ---------------- */}
      <section id="quiz-builder" className="py-20 bg-[#080E1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5 text-left">
              <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
                High-Pacing Video Quizzes
              </span>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                Designed for Viral Cricket Trivia Channels
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Building cricket quizzes in standard video editors means keyframing tens of text layers, countdown bars,
                chimes, and reveal cards manually. Cricket Creator Studio turns that into a structured, line-by-line
                workflow.
              </p>
              <div className="space-y-3 text-xs text-slate-300 pt-2">
                <div className="p-3 rounded-xl bg-[#0C1426] border border-slate-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <strong className="text-slate-100">Bulk Importer with 3 Merge Modes:</strong>
                    <div className="text-slate-400 mt-0.5">
                      Fill empty question slots, append to existing banks, or replace completely from CSV/JSON.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0C1426] border border-slate-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <strong className="text-slate-100">Field Backdrop Overlay:</strong>
                    <div className="text-slate-400 mt-0.5">
                      Show tactical pitch diagrams behind trivia questions to turn static quizzes into visual match
                      puzzles.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartCreating}
                  className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] font-bold text-xs flex items-center gap-2"
                >
                  <span>Try Quiz Builder</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0C1426] border border-slate-700/80 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                <span className="font-semibold text-slate-200">Bulk Question Importer Preview</span>
                <span className="text-[#D4AF37] font-mono">Format: CSV / Paste Text</span>
              </div>
              <div className="p-3 rounded-lg bg-[#080E1A] font-mono text-xs text-slate-300 leading-relaxed border border-slate-800">
                <div className="text-slate-500">// Example Paste Text Block</div>
                <div>Q: Who won the ICC Men's T20 World Cup in 2024?</div>
                <div>A: South Africa</div>
                <div>*B: India</div>
                <div>C: Australia</div>
                <div>D: England</div>
                <div className="text-[#D4AF37]">Time: 8s | Cat: T20 World Cup | Diff: Medium</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Validator verified: 1 question parsed, correct answer marked, countdown set.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 6. TACTICAL FIELD DESIGNER SHOWCASE ---------------- */}
      <section id="field-designer" className="py-20 bg-[#0A1120] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 rounded-2xl bg-[#080E1A] border border-slate-700/80 p-6 shadow-xl relative overflow-hidden">
              <div className="aspect-[4/3] rounded-xl bg-[#0F291E] border border-emerald-800/70 p-4 relative flex items-center justify-center">
                <div className="w-[85%] h-[85%] rounded-full border border-white/30 flex items-center justify-center relative">
                  <div className="w-[58%] h-[58%] rounded-full border border-dashed border-white/20 flex items-center justify-center">
                    <div className="w-7 h-16 bg-[#D4A373] rounded-sm" />
                  </div>

                  {/* Fielders */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#080E1A] font-bold text-[9px]">
                    Long-Off
                  </div>
                  <div className="absolute top-12 left-8 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#080E1A] font-bold text-[9px]">
                    Deep Cover
                  </div>
                  <div className="absolute bottom-6 right-10 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#080E1A] font-bold text-[9px]">
                    Fine Leg
                  </div>
                  <div className="absolute bottom-16 left-12 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#080E1A] font-bold text-[9px]">
                    Mid-Wicket
                  </div>
                </div>

                {/* Trajectory line */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 200 200">
                    <path d="M 100 110 Q 120 70 145 45" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="3 3" />
                    <circle cx="145" cy="45" r="4" fill="#EF4444" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#D4AF37]">FORMATION: Spin Choke (2 Catchers)</span>
                <span className="text-emerald-400 font-mono">BATTER: Right-Handed</span>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-5 text-left">
              <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
                Broadcast Visuals
              </span>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                Animate Real Match Tactics & Field Placements
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Illustrate match breakdowns, death-overs boundary setups, captaincy decisions, and wicket dismissals
                with our coordinate-accurate cricket field simulator.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 pt-2">
                <div className="p-3 rounded-xl bg-[#080E1A] border border-slate-800">
                  <div className="font-bold text-slate-100">Handedness Switch</div>
                  <div className="text-slate-400 mt-1">Instant RHB / LHB off-side vs leg-side zone flip.</div>
                </div>
                <div className="p-3 rounded-xl bg-[#080E1A] border border-slate-800">
                  <div className="font-bold text-slate-100">Fielder Numbers</div>
                  <div className="text-slate-400 mt-1">Assign custom jersey numbers and highlighted rings.</div>
                </div>
                <div className="p-3 rounded-xl bg-[#080E1A] border border-slate-800">
                  <div className="font-bold text-slate-100">Circle Toggle</div>
                  <div className="text-slate-400 mt-1">Display or hide the 30-yard fielding restriction circle.</div>
                </div>
                <div className="p-3 rounded-xl bg-[#080E1A] border border-slate-800">
                  <div className="font-bold text-slate-100">Ball Scrubbing</div>
                  <div className="text-slate-400 mt-1">Scrub from release to bounce, shot angle and boundary.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 7. SUPPORTED VIDEO FORMATS ---------------- */}
      <section className="py-20 bg-[#080E1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
              Omnichannel Publishing
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mt-2">
              Three Aspect Ratios. One Single Project.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Format 1 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="font-mono text-sm text-[#D4AF37]">16:9 Landscape</span>
                  <Monitor className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-display font-bold text-white">YouTube Long-Form Videos</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Full 1920x1080 or 1280x720 widescreen masters. Optimized for high-retention 10-30 minute quiz
                  episodes and tactical match analyses.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                Resolution: 1920x1080 @ 30/60 fps
              </div>
            </div>

            {/* Format 2 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-[#D4AF37]/50 flex flex-col justify-between shadow-lg shadow-[#D4AF37]/5">
              <div>
                <div className="flex items-center justify-between text-amber-300 mb-3">
                  <span className="font-mono text-sm text-[#D4AF37]">9:16 Vertical</span>
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-display font-bold text-white">YouTube Shorts & Reels</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  1080x1920 vertical framing with safe-area protection so text cards never overlap comments, channel
                  watermarks or engagement buttons.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-[#D4AF37]">
                Resolution: 1080x1920 @ 30/60 fps
              </div>
            </div>

            {/* Format 3 */}
            <div className="p-6 rounded-2xl bg-[#0C1426] border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="font-mono text-sm text-[#D4AF37]">1:1 Square</span>
                  <Square className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-display font-bold text-white">Social Feeds & Community</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  1080x1080 square format for YouTube Community posts, Twitter/X video previews, and Instagram feed
                  carousels.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                Resolution: 1080x1080 @ 30 fps
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 8. TARGET AUDIENCE ---------------- */}
      <section className="py-20 bg-[#0A1120] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
              Built For You
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mt-2">
              Who Uses Cricket Creator Studio?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div className="p-5 rounded-xl bg-[#080E1A] border border-slate-800">
              <Youtube className="w-6 h-6 text-red-500 mb-3" />
              <h3 className="text-sm font-display font-bold text-slate-100">YouTube Creators</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Publish high-volume weekly quiz episodes and auto-generate exact video chapter markers.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#080E1A] border border-slate-800">
              <Smartphone className="w-6 h-6 text-[#D4AF37] mb-3" />
              <h3 className="text-sm font-display font-bold text-slate-100">Shorts & Reels Editors</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Create 60-second vertical trivia and tactical puzzles without manual re-cropping.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#080E1A] border border-slate-800">
              <Compass className="w-6 h-6 text-emerald-400 mb-3" />
              <h3 className="text-sm font-display font-bold text-slate-100">Tactical Analysts</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Diagram match strategies, captaincy masterstrokes, and boundary setups with coordinate precision.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#080E1A] border border-slate-800">
              <Radio className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="text-sm font-display font-bold text-slate-100">Cricket Communities</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Engage fanbase audiences on Discord, X, and YouTube Community with branded visual quizzes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 9. FREQUENTLY ASKED QUESTIONS ---------------- */}
      <section id="faq" className="py-20 bg-[#080E1A]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-semibold text-[#D4AF37] tracking-wider uppercase">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl font-display font-bold text-white tracking-tight mt-2">
              Everything You Need to Know
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl bg-[#0C1426] border border-slate-800/90 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#D4AF37]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- 10. FINAL CALL TO ACTION ---------------- */}
      <section className="py-20 bg-gradient-to-b from-[#0A1120] to-[#080E1A] border-t border-slate-800/80 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center mx-auto shadow-lg shadow-[#D4AF37]/10">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white tracking-tight">
            Ready to Produce Your Next Cricket Episode?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Open the studio now in offline Guest Mode, or sign in to build your next cricket video project with automated
            field diagrams and synchronized audio.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleStartCreating}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#D4AF37]/25 transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              <span>Launch Creator Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-[#D4AF37]" />
              <span>Go to Creator Dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- 11. FOOTER ---------------- */}
      <footer className="bg-[#050912] border-t border-slate-800/80 py-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#D4AF37] text-[#080E1A] font-display font-bold text-xs flex items-center justify-center">
              CC
            </div>
            <span className="font-display font-semibold text-slate-200">Cricket Creator Studio</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">Private & Proprietary · GXA Technology</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-slate-200 transition-colors">
              Home
            </Link>
            <Link to="/dashboard" className="hover:text-slate-200 transition-colors">
              Dashboard
            </Link>
            <Link to="/studio" className="hover:text-slate-200 transition-colors">
              Studio
            </Link>
            {isGuest ? (
              <Link to="/login" className="hover:text-slate-200 transition-colors">
                Sign In
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                className="hover:text-slate-200 transition-colors"
              >
                Account Settings
              </button>
            )}
          </div>

          <div className="text-slate-500 font-mono text-[11px]">
            React 19 · Vite 8 · WebCodecs · Tailwind CSS v4
          </div>
        </div>
      </footer>
    </div>
  );
}

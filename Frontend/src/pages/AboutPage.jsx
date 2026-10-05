import { Link } from 'react-router-dom';
import {
  Code2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Globe2,
  Cpu,
  Database,
  Lock,
  Layers,
  Award,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Mail,
  HeartHandshake
} from 'lucide-react';
import useSeo from '../hooks/useSeo';
import { AUTHOR_INFO } from '../utils/constants';

const GithubIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const AUTHOR = {
  ...AUTHOR_INFO,
  location: 'India',
  bio: 'Specialized in architecting high-performance, fault-tolerant web applications, robust payment flows with cryptographic verification, and scalable MERN systems with enterprise-grade security standards.',
};

const TECH_PILLARS = [
  {
    icon: Cpu,
    title: 'Modern Frontend Architecture',
    desc: 'React 19, Vite 8, and Tailwind CSS 4 delivering near-instant sub-second route transitions, responsive micro-interactions, and WCAG 2.1 AA accessibility compliance.',
  },
  {
    icon: Database,
    title: 'Resilient Node & Mongo Backend',
    desc: 'Express 4.19 REST API deployed on Render paired with MongoDB Atlas cloud clusters, featuring indexed query optimization, transactional cart sync, and multi-role RBAC.',
  },
  {
    icon: Lock,
    title: 'Cryptographic Security & Auth',
    desc: 'Triple-method authentication (Passwords, Google OAuth 2.0, OTP), strict Content Security Policies, and Razorpay HMAC-SHA256 signature verification preventing tamper attacks.',
  },
  {
    icon: Zap,
    title: 'Real-Time Edge Reliability',
    desc: 'Socket.io event bridges for live order tracking, circuit breaker error resilience, progressive web app service worker caching, and Vercel Edge CDN distribution.',
  },
];

const EEAT_HIGHLIGHTS = [
  {
    pillar: 'Experience',
    badge: 'Hands-on Production Systems',
    details: 'Engineered the complete Cartify ecosystem from database schemas and authentication controllers to responsive UI and live deployment on Vercel and Render.',
  },
  {
    pillar: 'Expertise',
    badge: 'Full Stack MERN & Security',
    details: 'Deep mastery of React 19 concurrent features, Vite bundling pipelines, Node.js asynchronous I/O, MongoDB aggregation pipelines, and Razorpay API integration.',
  },
  {
    pillar: 'Authoritativeness',
    badge: 'Verifiable Open Source & Code Quality',
    details: 'All code, commit histories, architectural decision records (Phase 3 & Phase 4 docs), and automated test suites are publicly inspectable on GitHub.',
  },
  {
    pillar: 'Trustworthiness',
    badge: 'User Security & Transparent Policies',
    details: 'Zero plain-text secrets, strict cookie protections, sandbox testing disclosures, clear 3-5 day delivery SLAs, and 24/7 dedicated support channels.',
  },
];

const AboutPage = () => {
  useSeo({
    title: 'About the Creator & Engineering Architecture',
    description: `Discover how Cartify was built by ${AUTHOR.name}, ${AUTHOR.jobTitle}. Learn about the MERN stack architecture, security guarantees, and Google E-E-A-T standards.`,
    canonical: '/about',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: AUTHOR.name,
        jobTitle: AUTHOR.jobTitle,
        email: AUTHOR.email,
        url: 'https://cartify-hub.vercel.app/about',
        sameAs: [AUTHOR.linkedin, AUTHOR.github],
        worksFor: {
          '@type': 'Organization',
          name: 'Cartify',
          url: 'https://cartify-hub.vercel.app/',
        },
        knowsAbout: [
          'Full Stack Web Development',
          'MERN Stack Architecture',
          'React 19 & Vite 8',
          'Node.js & Express REST APIs',
          'Razorpay HMAC Payment Verification',
          'Answer Engine Optimization (AEO)',
          'Generative Engine Optimization (GEO)',
          'Search Engine Optimization (SEO)',
          'Core Web Vitals & Web Accessibility',
        ],
      },
    },
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-900 via-gray-900 to-gray-950 text-white py-16 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(13,148,136,0.2),transparent_70%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs sm:text-sm font-medium mb-6">
            <Sparkles size={14} className="text-teal-300" aria-hidden="true" />
            <span>Engineering Story &amp; Google E-E-A-T Transparency</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl">
            Architected for Speed, Security, and Scalability.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-gray-300 max-w-3xl leading-relaxed">
            Cartify is a flagship full-stack e-commerce project designed and engineered by{' '}
            <strong className="text-white font-semibold">{AUTHOR.name}</strong>, highlighting modern software engineering patterns, real-time logistics tracking, cryptographic payment verification, and generative discovery optimization.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={AUTHOR.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-gray-950 font-bold px-5 py-3 rounded-xl transition-all shadow-lg hover:shadow-teal-500/25 min-h-[44px]"
            >
              <GithubIcon size={18} aria-hidden="true" />
              <span>GitHub Profile</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>

            <a
              href={AUTHOR.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-5 py-3 rounded-xl transition-all min-h-[44px]"
            >
              <LinkedinIcon size={18} aria-hidden="true" />
              <span>LinkedIn Network</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>

            <a
              href={`mailto:${AUTHOR.email}`}
              className="inline-flex items-center gap-2 bg-gray-800/80 hover:bg-gray-800 text-gray-200 border border-gray-700 font-medium px-5 py-3 rounded-xl transition-all min-h-[44px]"
            >
              <Mail size={18} aria-hidden="true" />
              <span>{AUTHOR.email}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Author & Creator Entity Card */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between border-b border-gray-100 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white font-extrabold text-2xl sm:text-3xl shadow-md shrink-0">
                SP
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900">{AUTHOR.name}</h2>
                  <CheckCircle2 size={20} className="text-teal-600 shrink-0" aria-label="Verified Creator" />
                </div>
                <p className="text-sm sm:text-base font-semibold text-teal-700">{AUTHOR.jobTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cartify Creator &amp; System Architect</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full text-xs font-semibold">
                React 19 &amp; Vite 8
              </span>
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-semibold">
                Node.js &amp; Express
              </span>
              <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                MongoDB Atlas
              </span>
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full text-xs font-semibold">
                Razorpay HMAC
              </span>
            </div>
          </div>

          <div className="mt-6 text-gray-600 text-sm sm:text-base leading-relaxed">
            <p>{AUTHOR.bio}</p>
          </div>
        </div>
      </section>

      {/* Google E-E-A-T Framework Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-teal-700 font-bold text-xs uppercase tracking-wider mb-2">
            <Award size={16} aria-hidden="true" />
            <span>Search Quality Rater Standards</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900">
            Engineered for Google E-E-A-T
          </h2>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            How Cartify satisfies Google's Experience, Expertise, Authoritativeness, and Trustworthiness criteria for modern internet indexing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EEAT_HIGHLIGHTS.map((item) => (
            <div
              key={item.pillar}
              className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-teal-600 font-black text-sm uppercase tracking-wider">
                  {item.pillar}
                </span>
                <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2.5 py-1 rounded-md">
                  {item.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.badge}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.details}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Architecture & Stack Pillars */}
      <section className="bg-white border-y border-gray-200 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900">
              Technical Architecture Highlights
            </h2>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">
              Core architectural pillars powering the storefront, logistics, and authentication lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TECH_PILLARS.map((col) => {
              const Icon = col.icon;
              return (
                <div
                  key={col.title}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-teal-200 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{col.title}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{col.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Transparency Signals */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-teal-800 to-teal-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-teal-300 text-sm font-semibold mb-3">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>Consumer Protection &amp; Transparency</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black mb-4">
              Built with uncompromising integrity.
            </h2>
            <p className="text-teal-100 text-sm sm:text-base leading-relaxed mb-8">
              Every payment flow utilizes server-side price recalculation from MongoDB records to prevent client-side cart tampering. Deliveries follow strict 3-5 business day timelines, and customer data is safeguarded with modern password hashing and tokenization.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/faq"
                className="inline-flex items-center gap-2 bg-white text-teal-900 font-bold px-6 py-3 rounded-xl hover:bg-teal-50 transition-colors min-h-[44px]"
              >
                <span>Read Help &amp; FAQs</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-teal-700/60 hover:bg-teal-700 border border-teal-500/50 text-white font-bold px-6 py-3 rounded-xl transition-colors min-h-[44px]"
              >
                <span>Explore Catalog</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;

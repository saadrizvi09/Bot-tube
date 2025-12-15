'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Lenis from 'lenis';
import { motion, useScroll, useTransform, useSpring, useMotionValue, useInView } from 'framer-motion';
import { 
  ArrowRightIcon, 
  ChartBarIcon, 
  BoltIcon, 
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ClockIcon,
  DocumentTextIcon,
  PlayCircleIcon,
  CubeTransparentIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

// --- MAGNETIC BUTTON COMPONENT ---
function MagneticButton({ 
  children, 
  className,
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 300 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Pull effect - stronger when closer
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
    const maxDistance = 80;
    const pullStrength = Math.max(0, 1 - distance / maxDistance);
    
    x.set(distanceX * pullStrength * 0.3);
    y.set(distanceY * pullStrength * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("inline-block", className)}
    >
      <motion.div style={{ x: springX, y: springY }}>
        {children}
      </motion.div>
    </div>
  );
}

// --- CUSTOM CURSOR COMPONENT ---
function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const [isHovering, setIsHovering] = useState(false);

  const springConfig = { damping: 25, stiffness: 200 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button')
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY]);

  return (
    <>
      <motion.div
        ref={cursorRef}
        className="fixed top-0 left-0 w-6 h-6 rounded-full border-2 border-blue-400 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isHovering ? 1.5 : 1,
          opacity: isHovering ? 0.8 : 1,
        }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-blue-400 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </>
  );
}

// --- FLOATING CARD WITH DEPTH ---
function FloatingCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100, rotateX: 45 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, type: "spring", stiffness: 100 }}
      whileHover={{ y: -20, scale: 1.02 }}
      className="relative"
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}

// --- ANIMATED COUNTER ---
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 30);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// --- SCROLL INDICATOR ---
function ScrollIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1 }}
      className="absolute bottom-12 left-1/2 -translate-x-1/2"
    >
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex flex-col items-center gap-2 text-gray-500"
      >
        <span className="text-xs font-medium">Scroll to explore</span>
        <div className="w-6 h-10 border-2 border-gray-700 rounded-full flex justify-center pt-2">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-blue-500 rounded-full"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [mounted, setMounted] = useState(false);

  // --- CLIENT-SIDE MOUNT CHECK ---
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- LENIS SMOOTH SCROLL SETUP ---
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // --- PARALLAX HOOKS ---
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroTextY = useTransform(scrollYProgress, [0, 0.2], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const featuresY = useTransform(scrollYProgress, [0.1, 0.4], [100, 0]);
  const statsY = useTransform(scrollYProgress, [0.3, 0.5], [100, 0]);

  return (
    <>
      {/* Custom Cursor */}
      <CustomCursor />
      
      <div ref={containerRef} className="relative min-h-screen bg-gray-950 text-white overflow-hidden selection:bg-purple-500/30 cursor-none">
        
        {/* NOISE OVERLAY */}
        <div className="fixed inset-0 z-[1] opacity-20 pointer-events-none" 
             style={{ 
               backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")',
               mixBlendMode: 'overlay'
             }}></div>

        {/* DYNAMIC BACKGROUND BLOBS */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1], 
              opacity: [0.3, 0.5, 0.3],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px]"
            style={{ mixBlendMode: 'screen' }}
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1], 
              opacity: [0.2, 0.4, 0.2],
              rotate: [0, -90, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-[20%] -left-[10%] w-[40vw] h-[40vw] bg-purple-600/20 rounded-full blur-[100px]"
            style={{ mixBlendMode: 'screen' }}
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1], 
              opacity: [0.15, 0.3, 0.15],
              rotate: [0, 45, 0]
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[10%] right-[20%] w-[35vw] h-[35vw] bg-indigo-600/20 rounded-full blur-[90px]"
            style={{ mixBlendMode: 'screen' }}
          />
        </div>

        {/* FLOATING PARTICLES */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          {mounted && [...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                y: [null, Math.random() * window.innerHeight],
                x: [null, Math.random() * window.innerWidth],
              }}
              transition={{
                duration: Math.random() * 20 + 10,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* HEADER */}
          <motion.header 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="fixed top-0 w-full z-50 backdrop-blur-md bg-gray-950/50 border-b border-white/5 transition-all duration-300"
          >
            <nav className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between h-20">
              <MagneticButton>
                <Link href="/" className="cursor-none">
                  <span className="text-2xl font-bold tracking-tighter group">
                    <span className="group-hover:text-blue-400 transition-colors">Bot</span>
                    <span className="text-blue-500 group-hover:text-purple-500 transition-colors">Tube</span>
                  </span>
                </Link>
              </MagneticButton>
              <div className="flex items-center gap-6">
                {isAuthenticated ? (
                  <>
                    <MagneticButton>
                      <Link href="/dashboard" className="cursor-none text-sm font-medium text-gray-400 hover:text-white transition-colors">
                        Dashboard
                      </Link>
                    </MagneticButton>
                    <form action="/api/auth/logout" method="post">
                      <MagneticButton>
                        <button type="submit" className="cursor-none text-sm font-medium text-red-400 hover:text-red-300 transition-colors">Sign out</button>
                      </MagneticButton>
                    </form>
                  </>
                ) : (
                  <>
                    <MagneticButton>
                      <Link href="/sign-in" className="cursor-none text-sm font-medium text-gray-400 hover:text-white transition-colors">
                        Sign in
                      </Link>
                    </MagneticButton>
                    <MagneticButton>
                      <Link href="/sign-up" className="cursor-none group relative px-6 py-2 rounded-full bg-white text-black font-semibold text-sm overflow-hidden inline-block">
                        <span className="relative z-10 group-hover:text-white transition-colors duration-300">Get Started</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out"></div>
                      </Link>
                    </MagneticButton>
                  </>
                )}
              </div>
            </nav>
          </motion.header>

          {/* HERO SECTION */}
          <main className="flex-grow pt-32 pb-20 px-6 relative">
            <motion.div 
              style={{ y: heroTextY, opacity: heroOpacity }}
              className="mx-auto max-w-5xl text-center space-y-8 relative"
            >
              {/* Pill Badge */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm text-gray-300"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Powered by Gemini & AssemblyAI
              </motion.div>

              {/* Main Headline with Gradient Animation */}
              <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9]">
                <motion.span 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="block text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-200 to-purple-400 animate-gradient"
                >
                  {isAuthenticated ? 'Welcome Back.' : 'Ask Anything.'}
                </motion.span>
                <motion.span 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="block text-4xl md:text-6xl text-gray-500 mt-4 font-medium"
                >
                  About Any YouTube Video
                </motion.span>
              </h1>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="max-w-2xl mx-auto text-lg text-gray-400"
              >
                {isAuthenticated
                  ? 'Ready to dive deeper? Your personal video assistant is waiting.'
                  : 'Transform passive watching into active learning. Chat with videos, extract summaries, and find answers instantly.'
                }
              </motion.p>

              {/* Call to Action */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: "spring" }}
                className="flex justify-center pt-8"
              >
                <MagneticButton>
                  <Link href={isAuthenticated ? "/videos/new" : "/sign-up"} className="cursor-none group relative inline-flex items-center gap-3 px-8 py-4 bg-blue-600 rounded-2xl overflow-hidden font-semibold text-white shadow-2xl shadow-blue-900/50 transition-transform active:scale-95">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-100 group-hover:opacity-0 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <span className="relative z-10">{isAuthenticated ? 'Add New Video' : 'Get Started Free'}</span>
                    <ArrowRightIcon className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </MagneticButton>
              </motion.div>

              <ScrollIndicator />
            </motion.div>

            {/* STATS SECTION */
            <motion.div 
              style={{ y: statsY }}
              className="mx-auto max-w-5xl mt-32 grid grid-cols-2 md:grid-cols-4 gap-8"
            >
              {[
                { value: 10000, suffix: "+", label: "Videos Processed" },
                { value: 95, suffix: "%", label: "Accuracy Rate" },
                { value: 2, suffix: "s", label: "Avg Response Time" },
                { value: 50, suffix: "+", label: "Languages Supported" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
                >
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-400 mt-2">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

           } {/* FEATURES GRID */}
            <motion.div 
              style={{ y: featuresY }}
              className="mx-auto max-w-7xl mt-32"
            >
              <div className="text-center mb-16">
                <motion.h2 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl md:text-5xl font-bold mb-4"
                >
                  Powerful Features
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-gray-400 text-lg"
                >
                  Everything you need to master video content
                </motion.p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FloatingCard delay={0.1}>
                  <FeatureCard
                    icon={<ChartBarIcon className="w-6 h-6 text-blue-400" />}
                    title="Smart Analysis"
                    description="AI-driven transcription and contextual understanding of video content with unprecedented accuracy."
                  />
                </FloatingCard>
                <FloatingCard delay={0.2}>
                  <FeatureCard
                    icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-400" />}
                    title="Instant Q&A"
                    description="Natural language processing allows you to chat with videos like having a conversation with an expert."
                  />
                </FloatingCard>
                <FloatingCard delay={0.3}>
                  <FeatureCard
                    icon={<BoltIcon className="w-6 h-6 text-indigo-400" />}
                    title="Lightning Fast"
                    description="Powered by Gemini for near-instantaneous responses and comprehensive summaries."
                  />
                </FloatingCard>
              </div>
            </motion.div>

            {/* HOW IT WORKS SECTION */}
            <div className="mx-auto max-w-7xl mt-40">
              <div className="text-center mb-20">
                <motion.h2 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl md:text-5xl font-bold mb-4"
                >
                  How It Works
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-gray-400 text-lg"
                >
                  Simple steps to get started
                </motion.p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    step: "01",
                    icon: <PlayCircleIcon className="w-8 h-8" />,
                    title: "Paste Video URL",
                    description: "Simply copy and paste any YouTube video link into our platform."
                  },
                  {
                    step: "02",
                    icon: <SparklesIcon className="w-8 h-8" />,
                    title: "AI Processing",
                    description: "Our AI analyzes the entire video content, creating a searchable knowledge base."
                  },
                  {
                    step: "03",
                    icon: <ChatBubbleLeftRightIcon className="w-8 h-8" />,
                    title: "Ask Questions",
                    description: "Chat naturally with the video and get instant, accurate answers."
                  }
                ].map((item, i) => (
                  <FloatingCard key={i} delay={i * 0.15}>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm h-full">
                        {/* Step Number */}
                        <div className="absolute -top-6 left-8 text-6xl font-bold text-white/5">
                          {item.step}
                        </div>
                        
                        {/* Icon */}
                        <motion.div 
                          whileHover={{ rotate: 360, scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                          className="relative z-10 mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/50"
                        >
                          {item.icon}
                        </motion.div>
                        
                        <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                        <p className="text-gray-400 leading-relaxed text-lg">{item.description}</p>
                      </div>
                    </div>
                  </FloatingCard>
                ))}
              </div>
            </div>

            {/* USE CASES SECTION */}
            <section className="mx-auto max-w-7xl mt-40">
              <div className="text-center mb-20">
                <motion.h2 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl md:text-5xl font-bold mb-4"
                >
                  Perfect For Everyone
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-gray-400 text-lg"
                >
                  From students to professionals, BotTube adapts to your needs
                </motion.p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  {
                    icon: <DocumentTextIcon className="w-6 h-6" />,
                    title: "Students & Educators",
                    description: "Extract key concepts, create study guides, and never miss important information from lecture videos.",
                    features: ["Instant summaries", "Quiz generation", "Note-taking assistant"]
                  },
                  {
                    icon: <RocketLaunchIcon className="w-6 h-6" />,
                    title: "Content Creators",
                    description: "Analyze competitor content, research trends, and gain insights from hours of video in minutes.",
                    features: ["Trend analysis", "Content research", "Time-saving tools"]
                  },
                  {
                    icon: <CubeTransparentIcon className="w-6 h-6" />,
                    title: "Developers & Tech",
                    description: "Jump to specific code examples, find solutions to technical problems, and learn efficiently.",
                    features: ["Code extraction", "Tutorial navigation", "Problem solving"]
                  },
                  {
                    icon: <ClockIcon className="w-6 h-6" />,
                    title: "Busy Professionals",
                    description: "Get the essence of webinars, conferences, and training videos without watching them entirely.",
                    features: ["Time optimization", "Key insights", "Action items"]
                  }
                ].map((useCase, i) => (
                  <FloatingCard key={i} delay={i * 0.1}>
                    <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-500 h-full">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white group-hover:scale-110 transition-transform duration-300">
                          {useCase.icon}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">{useCase.title}</h3>
                          <p className="text-gray-400 leading-relaxed">{useCase.description}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {useCase.features.map((feature, j) => (
                          <span key={j} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </FloatingCard>
                ))}
              </div>
            </section>

            {/* FINAL CTA SECTION */}
            <section className="mx-auto max-w-4xl mt-40 mb-20">
              <FloatingCard delay={0}>
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-12 text-center">
                  {/* Animated background elements */}
                  <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ duration: 20, repeat: Infinity }}
                      className="absolute -top-1/2 -right-1/2 w-full h-full bg-white/10 rounded-full blur-3xl"
                    />
                    <motion.div
                      animate={{ 
                        scale: [1.2, 1, 1.2],
                        rotate: [360, 180, 0]
                      }}
                      transition={{ duration: 20, repeat: Infinity }}
                      className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-white/10 rounded-full blur-3xl"
                    />
                  </div>

                  <div className="relative z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6"
                    >
                      <RocketLaunchIcon className="w-10 h-10 text-white" />
                    </motion.div>
                    
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                      Ready to Transform Your Learning?
                    </h2>
                    <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                      Join thousands of users who are already learning smarter, not harder.
                    </p>
                    
                    <MagneticButton>
                      <Link href={isAuthenticated ? "/videos/new" : "/sign-up"} className="cursor-none group inline-flex items-center gap-3 px-10 py-5 bg-white text-gray-900 rounded-2xl font-bold text-lg shadow-2xl hover:scale-105 transition-transform">
                        <span>{isAuthenticated ? 'Start Now' : 'Get Started Free'}</span>
                        <ArrowRightIcon className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </Link>
                    </MagneticButton>
                    
                    <p className="mt-6 text-white/60 text-sm">
                      No credit card required • Free forever plan available
                    </p>
                  </div>
                </div>
              </FloatingCard>
            </section>
          </main>

          {/* FOOTER */}
          <footer className="relative py-12 border-t border-white/5">
            <div className="mx-auto max-w-7xl px-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                <div className="md:col-span-2">
                  <Link href="/" className="text-2xl font-bold mb-4 block">
                    Bot<span className="text-blue-500">Tube</span>
                  </Link>
                  <p className="text-gray-400 mb-4 max-w-md">
                    Revolutionizing how you interact with video content through the power of AI.
                  </p>
                  <div className="flex gap-4">
                    {['twitter', 'github', 'discord'].map((social) => (
                      <a
                        key={social}
                        href="#"
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <span className="sr-only">{social}</span>
                        <div className="w-5 h-5 bg-gray-400 rounded-full" />
                      </a>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Product</h3>
                  <ul className="space-y-2 text-gray-400">
                    <li><Link href="#" className="hover:text-white transition-colors">Features</Link></li>
                    <li><Link href="#" className="hover:text-white transition-colors">Pricing</Link></li>
                    <li><Link href="#" className="hover:text-white transition-colors">API</Link></li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Company</h3>
                  <ul className="space-y-2 text-gray-400">
                    <li><Link href="#" className="hover:text-white transition-colors">About</Link></li>
                    <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
                    <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} BotTube. Built for the future of learning.</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

// --- FEATURE CARD COMPONENT ---
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-500 h-full relative overflow-hidden">
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-500" />
      
      <div className="relative z-10">
        <motion.div 
          whileHover={{ rotate: 360, scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-900 border border-white/10 group-hover:border-white/20 transition-all duration-300"
        >
          {icon}
        </motion.div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

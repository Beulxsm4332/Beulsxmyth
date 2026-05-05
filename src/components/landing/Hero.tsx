'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Shield, ArrowRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background: radial red gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(231,76,60,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60" />

      {/* Animated red glow particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${60 + i * 40}px`,
              height: `${60 + i * 40}px`,
              background: `radial-gradient(circle, rgba(231,76,60,${0.15 - i * 0.02}) 0%, transparent 70%)`,
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#333] bg-[#111]/60 px-4 py-1.5 backdrop-blur-sm"
        >
          <Shield className="h-4 w-4 text-[#e74c3c]" />
          <span className="text-xs sm:text-sm font-semibold tracking-wider text-[#e74c3c]">
            #1 SERVER-SIDE EXECUTION PLATFORM
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight"
        >
          READY TO DEPLOY YOUR{' '}
          <span className="text-gradient-red">FIRST EVENT?</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-[#a0a0a0] leading-relaxed"
        >
          Join thousands of developers running better events with Beulrock Serverside.
          The only professional solution for Roblox server-side execution.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/auth/register">
            <Button
              size="lg"
              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-base px-8 py-6 shadow-[0_0_30px_rgba(231,76,60,0.4)] hover:shadow-[0_0_40px_rgba(231,76,60,0.6)] transition-shadow"
            >
              START FOR FREE
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="border-[#333] text-white hover:bg-[#1a1a1a] hover:text-white bg-transparent text-base px-8 py-6"
          >
            <FileText className="mr-2 h-5 w-5" />
            VIEW DOCUMENTATION
          </Button>
        </motion.div>

        {/* Decorative bottom fade */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none"
        />
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'Platforms', href: '#platforms' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '#docs' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#222] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-[#e74c3c]" />
          <span className="text-lg font-bold text-white tracking-tight">BEULROCK</span>
          <span className="hidden sm:inline text-sm font-semibold text-[#e74c3c] tracking-wider">SERVERSIDE</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-sm text-[#a0a0a0] hover:text-white transition-colors rounded-md hover:bg-[#1a1a1a]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login">
            <Button
              variant="outline"
              className="border-[#333] text-white hover:bg-[#1a1a1a] hover:text-white bg-transparent"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white shadow-[0_0_20px_rgba(231,76,60,0.3)]">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2 hover:bg-[#1a1a1a] rounded-md transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-[#222] bg-[#0a0a0a]/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] rounded-md transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2 border-t border-[#222] mt-2">
                <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full border-[#333] text-white hover:bg-[#1a1a1a] hover:text-white bg-transparent"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white shadow-[0_0_20px_rgba(231,76,60,0.3)]">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

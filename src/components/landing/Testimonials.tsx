'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    quote:
      'Beulrock Serverside changed how we run weekly events. The execution speed is unmatched.',
    author: 'BloxYard',
    role: 'Game Developer',
    stars: 5,
  },
  {
    quote:
      'The HWID security gives us peace of mind. No more unauthorized access to our servers.',
    author: 'ScriptForge',
    role: 'Roblox Engineer',
    stars: 5,
  },
  {
    quote:
      'From setup to execution in under 5 minutes. The support team is incredibly responsive.',
    author: 'DevHub',
    role: 'Studio Lead',
    stars: 5,
  },
]

export default function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-sm font-semibold tracking-widest text-[#e74c3c] mb-3"
          >
            TRUSTED BY DEVELOPERS
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold text-white"
          >
            What Developers Say
          </motion.h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative rounded-xl border border-[#222] bg-[#111] p-6 hover:border-[#333] transition-colors"
            >
              {/* Quote icon */}
              <Quote className="h-8 w-8 text-[#e74c3c]/30 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(t.stars)].map((_, s) => (
                  <Star
                    key={s}
                    className="h-4 w-4 fill-[#f1c40f] text-[#f1c40f]"
                  />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-[#a0a0a0] text-sm leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#e74c3c]/20 border border-[#e74c3c]/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#e74c3c]">
                    {t.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.author}</p>
                  <p className="text-xs text-[#a0a0a0]">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

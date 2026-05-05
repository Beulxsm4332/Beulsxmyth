'use client'

import { motion } from 'framer-motion'
import { Users, Zap, Shield, Globe } from 'lucide-react'

const stats = [
  {
    icon: Users,
    value: '10,000+',
    label: 'Developers Trust Us',
  },
  {
    icon: Zap,
    value: '50M+',
    label: 'Events Executed',
  },
  {
    icon: Shield,
    value: '99.9%',
    label: 'Uptime Guarantee',
  },
  {
    icon: Globe,
    value: '20+',
    label: 'Supported Games',
  },
]

export default function Stats() {
  return (
    <section className="relative py-20">
      {/* Subtle top/bottom border lines */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col items-center text-center gap-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e74c3c]/10 border border-[#e74c3c]/20">
                  <Icon className="h-5 w-5 text-[#e74c3c]" />
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-[#a0a0a0]">{stat.label}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

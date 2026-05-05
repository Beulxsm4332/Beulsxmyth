'use client'

import { motion } from 'framer-motion'
import { Zap, Code, Shield, Headphones } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Server-Side Execution',
    description:
      'Execute scripts on the server with ultra-low latency and enterprise-grade reliability.',
  },
  {
    icon: Code,
    title: 'Script Hub',
    description:
      'Access a curated library of pre-built scripts and templates for rapid development.',
  },
  {
    icon: Shield,
    title: 'HWID Security',
    description:
      'Advanced hardware identification and binding for maximum account protection.',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    description:
      'Round-the-clock expert support with average response time under 5 minutes.',
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.15 },
  }),
}

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
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
            POWERFUL FEATURES
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold text-white"
          >
            Everything You Need
          </motion.h2>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="group relative rounded-xl border border-[#222] bg-[#111] p-6 transition-all duration-300 hover:border-[#e74c3c]/60 hover:shadow-[0_0_30px_rgba(231,76,60,0.15)]"
              >
                {/* Icon */}
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20">
                  <Icon className="h-6 w-6 text-[#e74c3c]" />
                </div>

                {/* Title */}
                <h3 className="mb-2 text-lg font-semibold text-white group-hover:text-[#e74c3c] transition-colors">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#a0a0a0] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const plans = [
  {
    name: 'FREE',
    price: '$0',
    period: '/mo',
    popular: false,
    features: [
      '5 Whitelist slots',
      '10 events per game',
      'Basic script hub',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaStyle: 'border-[#333] text-white hover:bg-[#1a1a1a] hover:text-white bg-transparent',
  },
  {
    name: 'BASIC',
    price: '$7',
    period: '/mo',
    popular: true,
    features: [
      '20 Whitelist slots',
      '50 events per game',
      'Full script hub',
      'Priority support',
      'Custom scripts',
    ],
    cta: 'Get Basic',
    ctaStyle: 'bg-[#e74c3c] hover:bg-[#c0392b] text-white shadow-[0_0_20px_rgba(231,76,60,0.3)]',
  },
  {
    name: 'PREMIUM',
    price: '$15',
    period: '/mo',
    popular: false,
    features: [
      '50 Whitelist slots',
      'Unlimited events',
      'Full script hub + exclusives',
      '24/7 dedicated support',
      'Custom scripts',
      'API access',
    ],
    cta: 'Get Premium',
    ctaStyle: 'border-[#333] text-white hover:bg-[#1a1a1a] hover:text-white bg-transparent',
  },
  {
    name: 'ULTIMATE',
    price: '$30',
    period: '/mo',
    popular: false,
    features: [
      'Unlimited slots',
      'Unlimited everything',
      'Everything in Premium',
      'Kernel-level execution',
      'White-label option',
      'SLA guarantee',
    ],
    cta: 'Get Ultimate',
    ctaStyle: 'bg-[#e74c3c] hover:bg-[#c0392b] text-white shadow-[0_0_20px_rgba(231,76,60,0.3)]',
  },
]

export default function PricingCards() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
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
            CHOOSE YOUR PLAN
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold text-white"
          >
            Simple, Transparent, Powerful.
          </motion.h2>
        </div>

        {/* Pricing cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-xl border bg-[#111] p-6 transition-all duration-300 ${
                plan.popular
                  ? 'border-[#e74c3c] shadow-[0_0_40px_rgba(231,76,60,0.2)] scale-[1.02]'
                  : 'border-[#222] hover:border-[#333]'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-[#e74c3c] px-4 py-1 text-xs font-bold text-white shadow-[0_0_15px_rgba(231,76,60,0.4)]">
                    POPULAR
                  </span>
                </div>
              )}

              {/* Plan name */}
              <p className="text-sm font-semibold tracking-wider text-[#a0a0a0] mb-2">
                {plan.name}
              </p>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                <span className="text-[#a0a0a0] text-sm">{plan.period}</span>
              </div>

              {/* Divider */}
              <div className="border-t border-[#222] mb-6" />

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 mt-0.5 text-[#e74c3c] shrink-0" />
                    <span className="text-sm text-[#a0a0a0]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link href="/auth/register" className="block">
                <Button className={`w-full ${plan.ctaStyle}`} size="lg">
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

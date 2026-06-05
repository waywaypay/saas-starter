import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BarChart3,
  Compass,
  FileText,
  TrendingUp,
} from 'lucide-react';

const platforms = [
  { label: 'Instagram', color: '#E1306C' },
  { label: 'TikTok', color: '#69C9D0' },
  { label: 'LinkedIn', color: '#0A66C2' },
  { label: 'Facebook', color: '#1877F2' },
  { label: 'YouTube', color: '#FF0000' },
];

const features = [
  {
    icon: BarChart3,
    title: 'Unified analytics',
    description:
      'Reach, impressions, engagement and follower growth from every network, combined into one dashboard with week-over-week trends.',
  },
  {
    icon: Compass,
    title: 'Content & discovery insights',
    description:
      'Rank every post by engagement rate and discovery score to see exactly which content reached beyond your existing audience.',
  },
  {
    icon: FileText,
    title: 'Shareable reports',
    description:
      'Turn 90 days of cross-platform performance into a clean report you can hand to clients or stakeholders in seconds.',
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-600">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Social media analytics
              </div>
              <h1 className="mt-4 text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                Every social channel.
                <span className="block text-orange-500">One dashboard.</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                SocialOS unifies your Instagram, TikTok, LinkedIn, Facebook and
                YouTube performance into a single source of truth — track reach,
                engagement and follower growth, and find the content that
                actually works.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button asChild size="lg" className="text-lg rounded-full">
                  <Link href="/socialos/dashboard">
                    View live dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-lg rounded-full"
                >
                  <Link href="/sign-up">Create your account</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-2 sm:justify-center lg:justify-start">
                {platforms.map((p) => (
                  <span
                    key={p.label}
                    className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm text-gray-700"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="mt-12 sm:mx-auto sm:max-w-lg lg:mt-0 lg:max-w-none lg:col-span-6">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-xl p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Overview
                  </span>
                  <span className="text-xs text-gray-400">Last 30 days</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Reach', value: '1.13M', delta: '+8.4%' },
                    { label: 'Engagements', value: '70.8K', delta: '+5.1%' },
                    { label: 'Followers', value: '162K', delta: '+3.2%' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="text-xs text-gray-500">{kpi.label}</div>
                      <div className="mt-1 text-xl font-bold text-gray-900">
                        {kpi.value}
                      </div>
                      <div className="text-xs text-green-600">{kpi.delta}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {platforms.map((p, i) => (
                    <div key={p.label} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-gray-600">
                        {p.label}
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${90 - i * 14}%`,
                            backgroundColor: p.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="mt-10 first:mt-0 lg:mt-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <h2 className="text-lg font-medium text-gray-900">
                    {feature.title}
                  </h2>
                  <p className="mt-2 text-base text-gray-500">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Stop juggling five analytics tabs.
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500">
                Connect your accounts once and let SocialOS do the rest. See how
                every channel is performing, spot your breakout posts, and report
                on growth — all from one place.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 flex justify-center lg:justify-end">
              <Button asChild size="lg" className="text-lg rounded-full">
                <Link href="/sign-up">
                  Get started free
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

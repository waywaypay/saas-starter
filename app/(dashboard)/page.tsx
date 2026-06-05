import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, TrendingUp, Compass } from 'lucide-react';

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'YouTube'];

export default function HomePage() {
  return (
    <main>
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-wider text-orange-500">
                SocialOS Analytics
              </p>
              <h1 className="mt-2 text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                All your social analytics
                <span className="block text-orange-500">in one dashboard</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                Track reach, engagement, and follower growth across Instagram,
                TikTok, LinkedIn, Facebook, and YouTube — unified in a single
                view, with post-level insights and posting recommendations.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="text-lg rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href="/sign-up">
                    Get started free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-lg rounded-full"
                >
                  <Link href="/socialos/dashboard">View live dashboard</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                {PLATFORMS.join('  ·  ')}
              </p>
            </div>
            <div className="mt-12 sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Last 30 days
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <TrendingUp className="mr-1 h-3 w-3" /> Growing
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Stat label="Total reach" value="1.13M" />
                  <Stat label="Engagements" value="70.8K" />
                  <Stat label="Eng. rate" value="6.3%" />
                  <Stat label="Followers" value="162K" />
                </div>
                <div className="mt-6 flex items-end gap-1.5 h-24">
                  {[40, 55, 48, 62, 70, 58, 75, 82, 68, 88, 95, 100].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-orange-200"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <Feature
              icon={<BarChart3 className="h-6 w-6" />}
              title="Unified overview"
              body="Reach, impressions, engagement rate, and follower growth across every connected platform — with week-over-week trends, in one place."
            />
            <Feature
              icon={<TrendingUp className="h-6 w-6" />}
              title="Post-level insights"
              body="See which posts and content types actually drive results, ranked by reach and engagement, so you can double down on what works."
            />
            <Feature
              icon={<Compass className="h-6 w-6" />}
              title="Discovery & reports"
              body="Find the best times and formats to post, and export a clean performance report for your team or clients."
            />
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Ready to grow your audience?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500">
                Create an account and start tracking your social performance in
                minutes — or explore the live demo dashboard first.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 flex flex-col gap-3 sm:flex-row justify-center lg:justify-end">
              <Button
                asChild
                size="lg"
                className="text-lg rounded-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Link href="/sign-up">
                  Get started free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-lg rounded-full"
              >
                <Link href="/socialos/dashboard">View live dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-10 first:mt-0 lg:mt-0">
      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
        {icon}
      </div>
      <div className="mt-5">
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        <p className="mt-2 text-base text-gray-500">{body}</p>
      </div>
    </div>
  );
}

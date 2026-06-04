import { db } from './drizzle';
import { workspaces, platformConnections, dailyMetrics, posts } from './schema';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Caption pools
const CAPTIONS = {
  instagram_reel: [
    "🎬 Watch until the end! This is how we do it at Acme Brand 🔥 #reels #viral #trending",
    "POV: You finally found the brand that gets you 💫 Save this for later! #acmebrand #foryou",
    "We tried something new and the results were WILD 😱 #reelsviral #experiment",
    "This one tip changed everything for our clients 🚀 Drop a ❤️ if you agree! #growth",
    "Behind the scenes of our latest campaign 🎥 #bts #content #marketing",
    "3 things we learned this quarter that will surprise you 👀 #business #lessons",
    "Hot take: quality > quantity every single time 🔥 Agree? #contentstrategy",
    "Recreating viral trends with an Acme twist 😂 #viral #trending #fun",
    "The glow up is REAL ✨ #transformation #brand #acme",
    "Day in the life at Acme HQ 🏢 #dayinthelife #behindthescenes",
  ],
  instagram_carousel: [
    "Swipe to see our top 5 tips for brand growth 👉 Save this post! #tips #marketing",
    "Before & after: our rebrand journey 🎨 Swipe for the full story! #brand #design",
    "7 things every social media manager needs to know 📱 (slide 4 is a game-changer) #smm",
    "Our Q2 results are in — and we're sharing everything 📊 Swipe to see the breakdown!",
    "The content calendar that tripled our engagement 🗓️ Steal our strategy! #contentplan",
    "We surveyed 500 customers. Here's what they said 💬 (the last slide will shock you)",
    "A step-by-step guide to growing your brand that actually works 💪 Save for later! #howto",
    "5 mistakes we made so you don't have to 😅 #lessons #growth #brand",
    "Our team favorites this month ❤️ Swipe to see what we've been loving! #favorites",
    "Introducing: our new product line 🌟 Swipe to see all 6 styles! #newproduct #launch",
  ],
  instagram_static: [
    "Good vibes only ✨ #mondaymotivation #positivity #acmebrand",
    "Quality you can feel. Crafted with care. 🤍 #quality #brand",
    "Simple. Elegant. Yours. 🖤 #minimalist #lifestyle",
    "Making moments matter, one product at a time 🌿 #acme #lifestyle",
    "The weekend is calling 📞 #friday #vibes #relax",
    "Autumn collection is HERE 🍂 Shop now — link in bio! #newcollection",
    "What's your biggest goal this week? Drop it below 👇 #community #goals",
    "Meet the team behind the brand 👋 #teamacme #people",
    "New week, new opportunities 🌅 Let's get it! #mondaymotivation",
    "Grateful for every one of you 💙 #gratitude #community",
  ],
  tiktok_video: [
    "I can't believe this actually worked 😭 #fyp #viral #lifehack",
    "POV: you just found your new favorite brand 🔥 #foryou #trending",
    "Wait for it... 🫢 #satisfying #viral #fyp",
    "The truth about marketing that nobody talks about 👀 #exposed #fyp",
    "Doing this for 30 days — here are my results 📈 #challenge #30days",
    "Rate our new launch out of 10! 🎯 Comment below #newproduct",
    "Things our customers say vs. what they mean 😂 #relatable #funny",
    "Behind the scenes of a brand shoot 🎬 #bts #brandshoot",
    "I tested 5 strategies and here's the truth 🧪 #review #honest",
    "Stitch this if you agree 💯 #stitch #fyp #viral",
    "Can we normalize talking about brand values? 🤔 #normalize #fyp",
    "The most underrated tip for social media growth 🔑 #tips #hack",
    "Day 1 vs Day 90 💪 The transformation is real! #progress #glow",
    "This is how we plan a month of content in 2 hours ⏱️ #contentplan #smm",
    "What nobody tells you about going viral 🎯 #viral #truth",
  ],
  linkedin_static: [
    "Excited to share that Acme Brand has hit a major milestone this quarter. After 3 years of building, we've reached 10,000 customers. Here's what we learned along the way:",
    "Hot take: most marketing advice is designed for companies with 10x your budget. Here's what actually works at scale when you're resource-constrained.",
    "I spent 90 days analyzing top-performing B2B content. The #1 pattern? Specificity beats broad advice every time. Here's the data:",
    "We made a big mistake in our go-to-market strategy last year. I'm sharing it so you don't have to repeat it.",
    "Leadership lesson I wish I'd learned earlier: feedback is a gift, but only if you create a culture that makes giving it safe.",
    "3 frameworks we use at Acme Brand to make faster decisions without sacrificing quality:",
    "Unpopular opinion: your brand's weakness, communicated honestly, builds more trust than your strengths.",
    "Just wrapped our Q2 planning session. The ONE metric we're obsessing over going into Q3:",
    "What does building in public actually look like? Here's our unfiltered update for the month:",
    "The ROI of investing in your team's mental health isn't just moral — it's measurable. Here are our internal numbers:",
  ],
  linkedin_carousel: [
    "5 things I'd tell my 25-year-old self about building a brand 👇 (swipe for each one)",
    "Our content strategy evolved dramatically over 12 months. Here's what we changed at each stage:",
    "The exact framework we use for quarterly OKRs — adapted for SMBs:",
    "How we increased team retention by 40% in 2 years: the full story in slides",
    "Customer success framework that actually works: 6 slides, zero fluff",
    "The marketing channels that drove 80% of our growth (hint: it's not what you'd expect):",
    "Our onboarding process, step by step — because great hiring is only the beginning:",
    "Lessons from 500 sales calls: patterns we didn't expect to find",
    "The anatomy of a high-converting B2B case study — with real examples:",
    "6 books that fundamentally changed how I think about brand-building:",
  ],
  facebook_static: [
    "Happy Friday! ☀️ We're celebrating with a special offer for our community! 🎉",
    "Did you know? The average person spends 2.5 hours on social media daily 🤔 Share this with someone who needs to know!",
    "Shoutout to our amazing customers who've been with us since day 1 ❤️ You make all the difference!",
    "We're hiring! Know someone who'd be a great fit at Acme Brand? Tag them below 👇 #hiring",
    "Behind every great product is a team that cares 🤍 Meet the people behind the brand!",
    "This week's community question: What's the best brand experience you've ever had? Comment below! 💬",
    "Announcing our partnership with a leading industry platform! Together, we're doing something really exciting.",
    "Customer story: How one client transformed their results with Acme Brand. Real results, real people.",
    "Our most-loved product just got even better! New formula, same commitment to quality. 🌟",
    "Weekend plans? Tag a friend and make plans together! 🎉",
  ],
  facebook_video: [
    "Watch how our team brings ideas to life 🎥 From concept to creation — the full process revealed!",
    "Real customer, real results. This is why we do what we do 💪 (watch til the end!)",
    "New tutorial: How to get the most out of our products in under 3 minutes ⏱️ Save and share!",
    "Event recap: Thank you to everyone who joined us! Here's what went down 🎉",
    "Meet the person behind the operations at Acme Brand 👋 Watch their story!",
    "We asked, you answered! Here are your top responses to last week's poll 📊",
  ],
  facebook_carousel: [
    "Summer lookbook is HERE! 🌞 Swipe to see all our must-haves for the season →",
    "5 ways to use our products that you haven't tried yet 👈 Which is your favorite?",
    "Our story, told in 8 slides: from a tiny office to serving thousands worldwide 🌍",
    "The products our team uses every single day — no sponsorships, just honest picks 🤝",
    "Holiday gift guide: something for everyone on your list! 🎁 Swipe for our top recommendations →",
  ],
  youtube_video: [
    "In this video, we break down everything you need to know about social media marketing. From basics to advanced strategies — we cover it all. Subscribe for weekly insights!",
    "I tested 5 different content strategies for 30 days straight. Here's what actually happened (the results might surprise you). Watch until the end!",
    "The ultimate guide to building a brand audience in 2024. Whether you're a beginner or advanced, this video has something for you. Drop your questions in the comments!",
    "We spent significant resources on this experiment to answer one question. Was it worth it? Watch to find out!",
    "Interviewing the top performers in our industry — here are the patterns we found across 20+ conversations. This changed how I think about everything.",
    "Our 6-month brand transformation: the full journey, unfiltered and honest.",
    "Behind the scenes of how we create our content. Tools, process, team — everything revealed!",
    "The strategy that doubled our engagement in 90 days. Step-by-step breakdown with real examples.",
    "Q&A: Answering your top questions about brand building. Submit yours in the comments!",
    "Myth vs. Reality: debunking the most common misconceptions about social media with actual data.",
  ],
};

type PlatformConfig = {
  platform: string;
  accountName: string;
  initialFollowers: number;
  reachMin: number;
  reachMax: number;
  impressionsMultMin: number;
  impressionsMultMax: number;
  engagementsRateMin: number;
  engagementsRateMax: number;
  profileViewsRateMin: number;
  profileViewsRateMax: number;
};

type PostSpec = {
  contentType: string;
  count: number;
  captionKey: keyof typeof CAPTIONS;
  discoveryMin: number;
  discoveryMax: number;
  engagementMin: number;
  engagementMax: number;
};

type PostPlan = {
  platform: string;
  specs: PostSpec[];
};

async function seedSocialOS(): Promise<void> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const ninetyOneDaysAgo = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);

  // Create workspace
  const workspaceId = crypto.randomUUID();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'Acme Brand',
    slug: 'acme-brand',
    teamId: 1,
    createdAt: ninetyOneDaysAgo,
  });

  // Platform configs
  const platformConfigs: PlatformConfig[] = [
    {
      platform: 'instagram',
      accountName: '@acmebrand',
      initialFollowers: 48200,
      reachMin: 5000,
      reachMax: 15000,
      impressionsMultMin: 1.2,
      impressionsMultMax: 1.5,
      engagementsRateMin: 0.05,
      engagementsRateMax: 0.09,
      profileViewsRateMin: 0.02,
      profileViewsRateMax: 0.05,
    },
    {
      platform: 'tiktok',
      accountName: '@acme.brand',
      initialFollowers: 31500,
      reachMin: 8000,
      reachMax: 25000,
      impressionsMultMin: 1.1,
      impressionsMultMax: 1.3,
      engagementsRateMin: 0.04,
      engagementsRateMax: 0.08,
      profileViewsRateMin: 0.01,
      profileViewsRateMax: 0.03,
    },
    {
      platform: 'linkedin',
      accountName: 'Acme Brand',
      initialFollowers: 12800,
      reachMin: 800,
      reachMax: 2500,
      impressionsMultMin: 1.3,
      impressionsMultMax: 1.8,
      engagementsRateMin: 0.06,
      engagementsRateMax: 0.12,
      profileViewsRateMin: 0.05,
      profileViewsRateMax: 0.10,
    },
    {
      platform: 'facebook',
      accountName: 'Acme Brand Page',
      initialFollowers: 22100,
      reachMin: 3000,
      reachMax: 8000,
      impressionsMultMin: 1.2,
      impressionsMultMax: 1.6,
      engagementsRateMin: 0.03,
      engagementsRateMax: 0.06,
      profileViewsRateMin: 0.01,
      profileViewsRateMax: 0.03,
    },
    {
      platform: 'youtube',
      accountName: 'Acme Brand',
      initialFollowers: 9400,
      reachMin: 1000,
      reachMax: 5000,
      impressionsMultMin: 1.5,
      impressionsMultMax: 2.5,
      engagementsRateMin: 0.04,
      engagementsRateMax: 0.08,
      profileViewsRateMin: 0.03,
      profileViewsRateMax: 0.07,
    },
  ];

  // Create platform connections
  const connectionIds: Record<string, string> = {};
  for (const cfg of platformConfigs) {
    const connId = crypto.randomUUID();
    connectionIds[cfg.platform] = connId;
    await db.insert(platformConnections).values({
      id: connId,
      workspaceId,
      platform: cfg.platform,
      accountName: cfg.accountName,
      avatarUrl: null,
      connectedAt: ninetyOneDaysAgo,
      lastSyncAt: twoHoursAgo,
      isActive: true,
    });
  }

  // Build daily metrics — 90 days per connection
  // Also build a map: connectionId -> dateStr -> followers
  const followerMap = new Map<string, Map<string, number>>();

  const allDailyMetrics: Array<typeof dailyMetrics.$inferInsert> = [];

  for (const cfg of platformConfigs) {
    const connId = connectionIds[cfg.platform];
    const dateFollowerMap = new Map<string, number>();
    followerMap.set(connId, dateFollowerMap);

    let currentFollowers = cfg.initialFollowers;

    for (let day = 89; day >= 0; day--) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - day);

      const dateStr = dateToStr(date);

      // Followers: grow ~0.3%/day with ±0.1% noise
      const growthRate = 0.003 + rand(-0.001, 0.001);
      currentFollowers = Math.round(currentFollowers * (1 + growthRate));
      dateFollowerMap.set(dateStr, currentFollowers);

      const reach = randInt(cfg.reachMin, cfg.reachMax);
      const impressions = Math.round(reach * rand(cfg.impressionsMultMin, cfg.impressionsMultMax));
      const engagements = Math.round(reach * rand(cfg.engagementsRateMin, cfg.engagementsRateMax));
      const profileViews = Math.round(reach * rand(cfg.profileViewsRateMin, cfg.profileViewsRateMax));

      allDailyMetrics.push({
        id: crypto.randomUUID(),
        connectionId: connId,
        workspaceId,
        date,
        platform: cfg.platform,
        followers: currentFollowers,
        impressions,
        reach,
        engagements,
        profileViews,
      });
    }
  }

  // Insert daily metrics in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < allDailyMetrics.length; i += BATCH_SIZE) {
    await db.insert(dailyMetrics).values(allDailyMetrics.slice(i, i + BATCH_SIZE));
  }

  // Post plans per platform
  const postPlans: PostPlan[] = [
    {
      platform: 'instagram',
      specs: [
        { contentType: 'reel', count: 20, captionKey: 'instagram_reel', discoveryMin: 0.8, discoveryMax: 3.2, engagementMin: 0.06, engagementMax: 0.18 },
        { contentType: 'carousel', count: 18, captionKey: 'instagram_carousel', discoveryMin: 0.6, discoveryMax: 1.4, engagementMin: 0.04, engagementMax: 0.12 },
        { contentType: 'static', count: 12, captionKey: 'instagram_static', discoveryMin: 0.4, discoveryMax: 0.9, engagementMin: 0.02, engagementMax: 0.08 },
      ],
    },
    {
      platform: 'tiktok',
      specs: [
        { contentType: 'video', count: 45, captionKey: 'tiktok_video', discoveryMin: 0.8, discoveryMax: 3.2, engagementMin: 0.06, engagementMax: 0.18 },
      ],
    },
    {
      platform: 'linkedin',
      specs: [
        { contentType: 'static', count: 21, captionKey: 'linkedin_static', discoveryMin: 0.4, discoveryMax: 0.9, engagementMin: 0.02, engagementMax: 0.08 },
        { contentType: 'carousel', count: 14, captionKey: 'linkedin_carousel', discoveryMin: 0.6, discoveryMax: 1.4, engagementMin: 0.04, engagementMax: 0.12 },
      ],
    },
    {
      platform: 'facebook',
      specs: [
        { contentType: 'static', count: 20, captionKey: 'facebook_static', discoveryMin: 0.4, discoveryMax: 0.9, engagementMin: 0.02, engagementMax: 0.08 },
        { contentType: 'video', count: 12, captionKey: 'facebook_video', discoveryMin: 0.8, discoveryMax: 3.2, engagementMin: 0.06, engagementMax: 0.18 },
        { contentType: 'carousel', count: 8, captionKey: 'facebook_carousel', discoveryMin: 0.6, discoveryMax: 1.4, engagementMin: 0.04, engagementMax: 0.12 },
      ],
    },
    {
      platform: 'youtube',
      specs: [
        { contentType: 'video', count: 30, captionKey: 'youtube_video', discoveryMin: 0.8, discoveryMax: 3.2, engagementMin: 0.06, engagementMax: 0.18 },
      ],
    },
  ];

  const allPosts: Array<typeof posts.$inferInsert> = [];

  for (const plan of postPlans) {
    const connId = connectionIds[plan.platform];
    const dateFollowerMap = followerMap.get(connId)!;

    for (const spec of plan.specs) {
      for (let i = 0; i < spec.count; i++) {
        // Random day in last 90 days
        const daysAgo = randInt(0, 89);
        const postedAt = new Date(now);
        postedAt.setHours(0, 0, 0, 0);
        postedAt.setDate(postedAt.getDate() - daysAgo);
        // Random hour 6am–10pm
        const hour = randInt(6, 22);
        const minute = randInt(0, 59);
        postedAt.setHours(hour, minute, 0, 0);

        const dateStr = dateToStr(postedAt);
        const followerCountAtPostTime = dateFollowerMap.get(dateStr) ?? spec.count;

        const discoveryScore = rand(spec.discoveryMin, spec.discoveryMax);
        const reach = Math.round(followerCountAtPostTime * discoveryScore);
        const impressions = Math.round(reach * rand(1.1, 1.6));
        const engagementRate = rand(spec.engagementMin, spec.engagementMax);
        const totalEngagements = Math.round(reach * engagementRate);

        const likesShare = rand(0.60, 0.75);
        const commentsShare = rand(0.08, 0.15);
        const likes = Math.round(totalEngagements * likesShare);
        const comments = Math.round(totalEngagements * commentsShare);
        const shares = Math.max(0, totalEngagements - likes - comments);

        const saves = Math.round(reach * rand(0.01, 0.05));
        const linkClicks = Math.round(reach * rand(0.005, 0.02));

        const caption = pick(CAPTIONS[spec.captionKey]);

        allPosts.push({
          id: crypto.randomUUID(),
          connectionId: connId,
          workspaceId,
          platform: plan.platform,
          externalId: `${plan.platform}_${crypto.randomUUID()}`,
          caption,
          contentType: spec.contentType,
          postedAt,
          reach,
          impressions,
          likes,
          comments,
          shares,
          saves,
          linkClicks,
          engagementRate,
          thumbnailUrl: null,
          followerCountAtPostTime,
          discoveryScore,
        });
      }
    }
  }

  // Insert posts in batches
  for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
    await db.insert(posts).values(allPosts.slice(i, i + BATCH_SIZE));
  }

  console.log('Seeded 1 workspace, 5 connections, 450 daily metrics, 200 posts');
}

seedSocialOS()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

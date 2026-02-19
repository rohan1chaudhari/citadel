import { Shell, Card, Button } from '@/components/Shell';
import { ensurePromoKitSchema } from '@/lib/promoKitSchema';
import { dbQuery } from '@/lib/db';
import Link from 'next/link';
import { CopyButton } from './CopyButton';

export const runtime = 'nodejs';
const APP_ID = 'promo-kit';

interface Post {
  id: number;
  title: string;
  content: string;
  platform: string;
  status: string;
  image_prompt: string | null;
  commit_refs: string | null;
  created_at: string;
}

// Seed posts for initial content
const SEED_POSTS = [
  {
    title: 'OpenClaw + Local AI Setup',
    content: `Just set up my local AI workspace with OpenClaw 🦀

What's in the stack:
• Self-hosted AI gateway with multi-model support
• Local-first app platform (Citadel)
• Telegram, Discord, WhatsApp integrations
• Full control, full privacy

No cloud dependencies. No data leaks. Just pure productivity.

Building in public. More to come.

#OpenClaw #LocalAI #Privacy #BuildInPublic`,
    platform: 'both',
    image_prompt: 'A terminal window showing "OpenClaw" ASCII art with glowing green text on dark background, alongside code editor with configuration files'
  },
  {
    title: 'Why I Built Citadel',
    content: `Tired of SaaS apps holding my data hostage.

Built Citadel — a local-first app platform where:
• My data stays on my machine
• Apps are modular and isolated
• AI assistant has full context (safely)
• No subscription fatigue

It's like having a personal app store that actually respects you.

Currently running: Smart Notes, Gym Tracker, Mood Tracker, and a custom Scrum Board.

#LocalFirst #OpenSource #Privacy #Productivity`,
    platform: 'linkedin',
    image_prompt: 'Clean dashboard UI showing multiple app icons in a grid layout, modern minimal design with soft shadows'
  },
  {
    title: 'Local AI Daily Driver',
    content: `Day 1 of using local AI as my daily driver:

✅ Code reviews — local model handles it
✅ Task management — AI sees my scrum board
✅ Note taking — contextual suggestions
✅ All data stays local

Latency? Surprisingly good.
Quality? Getting better every week.
Privacy? Absolute.

The future is local-first.`,
    platform: 'twitter',
    image_prompt: null
  }
];

function ensureSeedPosts() {
  const existing = dbQuery<{ cnt: number }>(APP_ID, 'SELECT COUNT(*) as cnt FROM posts')[0];
  if (existing.cnt > 0) return;

  const now = new Date().toISOString();
  for (const post of SEED_POSTS) {
    dbQuery(APP_ID, 
      `INSERT INTO posts (title, content, platform, status, image_prompt, created_at, updated_at) 
       VALUES (?, ?, ?, 'ready', ?, ?, ?)`,
      [post.title, post.content, post.platform, post.image_prompt, now, now]
    );
  }
}

export default async function PromoKitPage() {
  ensurePromoKitSchema();
  ensureSeedPosts();

  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, content, platform, status, image_prompt, commit_refs, created_at 
     FROM posts
     ORDER BY created_at DESC`
  );

  const posts: Post[] = rows.map(r => ({
    id: Number(r.id),
    title: String(r.title),
    content: String(r.content),
    platform: String(r.platform),
    status: String(r.status),
    image_prompt: r.image_prompt ?? null,
    commit_refs: r.commit_refs ?? null,
    created_at: String(r.created_at)
  }));

  return (
    <Shell title="Promo Kit" subtitle="Generate social media content for your projects">
      <div className="space-y-6">
        {/* Instructions Card */}
        <Card className="bg-gradient-to-br from-zinc-50 to-white">
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">📸 How to Use</h2>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li className="flex gap-2">
              <span className="text-zinc-400">1.</span>
              <span>Copy any post using the copy button</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">2.</span>
              <span>If an image is suggested, take a screenshot or generate one</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">3.</span>
              <span>Post to your preferred platform</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">4.</span>
              <span>Mark as posted to track what you&apos;ve shared</span>
            </li>
          </ul>
        </Card>

        {/* Posts Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-zinc-900">{post.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      post.platform === 'twitter' ? 'bg-sky-100 text-sky-700' :
                      post.platform === 'linkedin' ? 'bg-blue-100 text-blue-700' :
                      'bg-zinc-100 text-zinc-700'
                    }`}>
                      {post.platform === 'both' ? 'Twitter + LinkedIn' : post.platform}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      post.status === 'posted' ? 'bg-green-100 text-green-700' :
                      post.status === 'ready' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {post.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans bg-zinc-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {post.content}
                </pre>
              </div>

              {post.image_prompt && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs font-medium text-amber-800 mb-1">📸 Image Suggestion:</p>
                  <p className="text-xs text-amber-700">{post.image_prompt}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <CopyButton text={post.content} />
                <Link 
                  href={`/apps/promo-kit/${post.id}`}
                  className="flex-1 text-center rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Edit / Mark Posted
                </Link>
              </div>
            </Card>
          ))}
        </div>

        {/* Git Commits Section */}
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">🔄 Generate from Commits</h2>
          <p className="text-sm text-zinc-600 mb-4">
            Create progress posts based on recent git commits. Great for &quot;building in public&quot; updates.
          </p>
          <Link
            href="/apps/promo-kit/commits"
            className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
          >
            View Recent Commits →
          </Link>
        </Card>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-600">No posts yet.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

import { Shell, Card, Button } from '@/components/Shell';
import { ensurePromoKitSchema } from '@/lib/promoKitSchema';
import { dbExec } from '@/lib/db';
import Link from 'next/link';
import { execSync } from 'child_process';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
const APP_ID = 'promo-kit';
const REPO_ROOT = '/home/rohanchaudhari/personal/citadel';

interface Commit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

function getAllCommits(): Commit[] {
  try {
    const output = execSync(
      `git -C "${REPO_ROOT}" log --all --pretty=format:"%h|%ai|%s|%an"`,
      { encoding: 'utf8', timeout: 10000 }
    );

    return output.trim().split('\n').map(line => {
      const [hash, date, ...rest] = line.split('|');
      const author = rest.pop() || '';
      const message = rest.join('|');
      return { hash, date, message, author };
    });
  } catch (err) {
    console.error('Failed to get commits:', err);
    return [];
  }
}

function categorizeCommit(message: string): { type: string; emoji: string; category: string } {
  const msg = message.toLowerCase();
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('repair')) {
    return { type: 'Fix', emoji: '🔧', category: 'fixes' };
  }
  if (msg.includes('add') || msg.includes('new') || msg.includes('create') || msg.includes('implement')) {
    return { type: 'Feature', emoji: '✨', category: 'features' };
  }
  if (msg.includes('update') || msg.includes('improve') || msg.includes('enhance') || msg.includes('upgrade')) {
    return { type: 'Improvement', emoji: '⚡', category: 'improvements' };
  }
  if (msg.includes('refactor') || msg.includes('cleanup') || msg.includes('clean up')) {
    return { type: 'Refactor', emoji: '♻️', category: 'refactors' };
  }
  if (msg.includes('style') || msg.includes('ui') || msg.includes('design') || msg.includes('css') || msg.includes('layout')) {
    return { type: 'UI', emoji: '🎨', category: 'ui' };
  }
  if (msg.includes('docs') || msg.includes('readme') || msg.includes('comment')) {
    return { type: 'Docs', emoji: '📝', category: 'docs' };
  }
  if (msg.includes('test') || msg.includes('spec')) {
    return { type: 'Tests', emoji: '🧪', category: 'tests' };
  }
  if (msg.includes('autopilot') || msg.includes('agent') || msg.includes('ai')) {
    return { type: 'AI', emoji: '🤖', category: 'ai' };
  }
  return { type: 'Update', emoji: '📝', category: 'updates' };
}

function generateStoryFromCommits(commits: Commit[]): { title: string; story: string; highlights: string[]; stats: Record<string, number> } {
  // Group by category
  const byCategory: Record<string, Commit[]> = {};
  commits.forEach(c => {
    const cat = categorizeCommit(c.message);
    if (!byCategory[cat.category]) byCategory[cat.category] = [];
    byCategory[cat.category].push(c);
  });

  // Calculate stats
  const stats: Record<string, number> = {};
  Object.entries(byCategory).forEach(([cat, list]) => {
    stats[cat] = list.length;
  });

  // Extract feature highlights (commits that add things)
  const featureCommits = commits.filter(c => {
    const msg = c.message.toLowerCase();
    return msg.includes('add') || msg.includes('new') || msg.includes('create') || msg.includes('implement');
  }).slice(0, 5);

  const highlights = featureCommits.map(c => {
    // Clean up the message
    let msg = c.message
      .replace(/^(add|create|new|implement)s?:?\s*/i, '')
      .replace(/^(feat|feature):?\s*/i, '')
      .trim();
    // Capitalize first letter
    msg = msg.charAt(0).toUpperCase() + msg.slice(1);
    return msg;
  });

  // Generate a story title
  const totalCommits = commits.length;
  const uniqueCategories = Object.keys(byCategory).length;

  let title = '';
  if (featureCommits.length > 0) {
    const latestFeature = featureCommits[0].message
      .replace(/^(add|create|new|implement)s?:?\s*/i, '')
      .replace(/^(feat|feature):?\s*/i, '')
      .trim();
    title = `Building: ${latestFeature.slice(0, 40)}${latestFeature.length > 40 ? '...' : ''}`;
  } else {
    title = `Project Update: ${totalCommits} Commits Across ${uniqueCategories} Areas`;
  }

  // Build the story narrative
  const storyParts: string[] = [];

  // Introduction
  storyParts.push(`I've been busy building.`);
  storyParts.push(`\n${totalCommits} commits later, here's what's shaping up:`);

  // Key areas worked on
  const topCategories = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  storyParts.push('\nKey focus areas:');
  topCategories.forEach(([cat, count]) => {
    const emoji = categorizeCommit(cat).emoji;
    storyParts.push(`${emoji} ${count} ${cat}${count > 1 ? 's' : ''}`);
  });

  return {
    title,
    story: storyParts.join('\n'),
    highlights,
    stats
  };
}

interface Commit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

async function generateCampaign() {
  'use server';

  const commits = getAllCommits();
  if (commits.length === 0) return;

  const { title, story, highlights, stats } = generateStoryFromCommits(commits);
  const shortHashes = commits.slice(0, 5).map(c => c.hash).join(', ') + (commits.length > 5 ? ` +${commits.length - 5} more` : '');

  const now = new Date().toISOString();

  // Twitter/X post (shorter, punchier)
  const twitterContent = `${story}

${highlights.length > 0 ? 'Highlights:\n' + highlights.slice(0, 3).map(h => `• ${h.slice(0, 50)}${h.length > 50 ? '...' : ''}`).join('\n') : ''}

#BuildInPublic #IndieDev`;

  // LinkedIn post (longer, more professional)
  const linkedinContent = `${story}

${highlights.length > 0 ? 'Notable additions:\n' + highlights.map(h => `• ${h}`).join('\n') : ''}

This is what local-first, AI-assisted development looks like. Every feature is intentional. Every commit is progress.

Building the future, one commit at a time.

#BuildInPublic #IndieDev #LocalFirst #OpenSource #AI`;

  // Combined/Both platforms post
  const bothContent = `${story}

${highlights.length > 0 ? 'What\'s new:\n' + highlights.slice(0, 4).map(h => `• ${h}`).join('\n') : ''}

The journey continues.

${Object.entries(stats).slice(0, 3).map(([cat, count]) => `${categorizeCommit(cat).emoji} ${count} ${cat}`).join(' • ')}

#BuildInPublic #LocalFirst #IndieDev`;

  // Insert posts for all platforms
  dbExec(APP_ID,
    `INSERT INTO posts (title, content, platform, status, commit_refs, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    [`${title} (Twitter)`, twitterContent, 'twitter', shortHashes, now, now]
  );

  dbExec(APP_ID,
    `INSERT INTO posts (title, content, platform, status, commit_refs, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    [`${title} (LinkedIn)`, linkedinContent, 'linkedin', shortHashes, now, now]
  );

  dbExec(APP_ID,
    `INSERT INTO posts (title, content, platform, status, commit_refs, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    [`${title} (Universal)`, bothContent, 'both', shortHashes, now, now]
  );

  revalidatePath('/apps/promo-kit');
}

function getRecentCommits(limit = 10): Commit[] {
  try {
    const output = execSync(
      `git -C "${REPO_ROOT}" log --all --pretty=format:"%h|%ai|%s|%an" -n ${limit}`,
      { encoding: 'utf8', timeout: 5000 }
    );
    
    return output.trim().split('\n').map(line => {
      const [hash, date, ...rest] = line.split('|');
      const author = rest.pop() || '';
      const message = rest.join('|');
      return { hash, date, message, author };
    });
  } catch (err) {
    console.error('Failed to get commits:', err);
    return [];
  }
}

async function generatePost(formData: FormData) {
  'use server';
  
  const commits = formData.get('commits') as string;
  const platform = formData.get('platform') as string;
  
  if (!commits) return;
  
  const commitList = JSON.parse(commits) as Commit[];
  const shortHashes = commitList.map(c => c.hash).join(', ');
  
  // Generate post content based on commits
  const changes = commitList.map(c => {
    const msg = c.message.toLowerCase();
    if (msg.includes('fix')) return '🔧 Bug fixes';
    if (msg.includes('add') || msg.includes('new') || msg.includes('create')) return '✨ New features';
    if (msg.includes('update') || msg.includes('improve')) return '⚡ Improvements';
    if (msg.includes('refactor')) return '♻️ Refactoring';
    if (msg.includes('style') || msg.includes('ui')) return '🎨 UI updates';
    return '📝 Updates';
  });
  
  const uniqueChanges = [...new Set(changes)];
  const featureMessages = commitList
    .filter(c => c.message.toLowerCase().includes('add') || c.message.toLowerCase().includes('new'))
    .map(c => c.message.replace(/^(add|create|new):?\s*/i, ''));
  
  const title = commitList.length === 1 
    ? `Update: ${commitList[0].message.slice(0, 50)}`
    : `Progress Update: ${commitList.length} commits`;
  
  const content = `Building in public 🚀

Recent updates to Citadel:
${uniqueChanges.map(c => `• ${c}`).join('\n')}
${featureMessages.length > 0 ? '\nHighlights:\n' + featureMessages.slice(0, 3).map(m => `• ${m}`).join('\n') : ''}

Every commit is progress. Every feature is user-requested.

${platform === 'twitter' ? '#BuildInPublic #IndieDev #OpenSource' : 'Building the local-first future, one commit at a time.\n\n#BuildInPublic #IndieDev #LocalFirst #OpenSource'}`;
  
  const now = new Date().toISOString();
  dbExec(APP_ID,
    `INSERT INTO posts (title, content, platform, status, commit_refs, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    [title, content, platform, shortHashes, now, now]
  );
  
  revalidatePath('/apps/promo-kit');
}

export default async function CommitsPage() {
  ensurePromoKitSchema();
  const commits = getRecentCommits(15);
  
  // Group commits by date
  const grouped = commits.reduce((acc, commit) => {
    const date = commit.date.split(' ')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(commit);
    return acc;
  }, {} as Record<string, Commit[]>);

  return (
    <Shell title="Git Commits" subtitle="Generate posts from recent commits">
      <div className="space-y-6">
        <Link 
          href="/apps/promo-kit"
          className="inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Back to Promo Kit
        </Link>

        {/* Generate Campaign Card */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
          <h2 className="text-lg font-semibold mb-2">🚀 Generate Full Campaign</h2>
          <p className="text-sm text-zinc-300 mb-4">
            Read <strong>all commits</strong>, create a cohesive story, and generate posts for 
            <strong> every platform</strong> (Twitter, LinkedIn, and universal). 
            Perfect for milestone updates and "building in public" threads.
          </p>
          <form action={generateCampaign}>
            <Button type="submit" className="bg-white text-zinc-900 hover:bg-zinc-100">
              Generate Posts for All Platforms
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-zinc-700 mb-4">Or select specific commits:</h2>
          
          <form action={generatePost} className="space-y-4">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(grouped).map(([date, dayCommits]) => (
                <div key={date} className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 sticky top-0 bg-white py-1">
                    {new Date(date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                  {dayCommits.map(commit => (
                    <label 
                      key={commit.hash} 
                      className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                    >
                      <input 
                        type="checkbox" 
                        name="commit-select"
                        value={JSON.stringify(commit)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 truncate">{commit.message}</p>
                        <p className="text-xs text-zinc-500">
                          {commit.hash} • {commit.author}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ))}
              
              {commits.length === 0 && (
                <p className="text-zinc-500 text-center py-8">No recent commits found</p>
              )}
            </div>

            <div className="border-t pt-4 flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-zinc-700">Platform:</label>
                <select 
                  name="platform" 
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="twitter">Twitter/X</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <Button type="submit" className="mt-5">
                Generate Post
              </Button>
            </div>
            
            <input type="hidden" name="commits" id="commits-input" />
          </form>
        </Card>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        const form = document.querySelector('form');
        const checkboxes = form.querySelectorAll('input[name=\"commit-select\"]');
        const commitsInput = document.getElementById('commits-input');
        
        form.addEventListener('submit', (e) => {
          const selected = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => JSON.parse(cb.value));
          
          if (selected.length === 0) {
            e.preventDefault();
            alert('Please select at least one commit');
            return;
          }
          
          commitsInput.value = JSON.stringify(selected);
        });
      `}} />
    </Shell>
  );
}

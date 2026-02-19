import { Shell, Card, Button } from '@/components/Shell';
import { ensurePromoKitSchema } from '@/lib/promoKitSchema';
import { dbQuery, dbExec } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
const APP_ID = 'promo-kit';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function markAsPosted(formData: FormData) {
  'use server';
  const id = formData.get('id');
  if (!id) return;
  
  const now = new Date().toISOString();
  dbExec(APP_ID, 
    'UPDATE posts SET status = \'posted\', posted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
  revalidatePath(`/apps/promo-kit/${id}`);
  revalidatePath('/apps/promo-kit');
}

async function markAsDraft(formData: FormData) {
  'use server';
  const id = formData.get('id');
  if (!id) return;
  
  const now = new Date().toISOString();
  dbExec(APP_ID, 
    'UPDATE posts SET status = \'draft\', posted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
  revalidatePath(`/apps/promo-kit/${id}`);
  revalidatePath('/apps/promo-kit');
}

async function deletePost(formData: FormData) {
  'use server';
  const id = formData.get('id');
  if (!id) return;
  
  dbExec(APP_ID, 'DELETE FROM posts WHERE id = ?', [id]);
  revalidatePath('/apps/promo-kit');
}

export default async function PostDetailPage({ params }: PageProps) {
  ensurePromoKitSchema();
  
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (isNaN(postId)) notFound();

  const row = dbQuery<any>(
    APP_ID,
    'SELECT * FROM posts WHERE id = ? LIMIT 1',
    [postId]
  )[0];

  if (!row) notFound();

  const post = {
    id: Number(row.id),
    title: String(row.title),
    content: String(row.content),
    platform: String(row.platform),
    status: String(row.status),
    image_prompt: row.image_prompt ?? null,
    image_path: row.image_path ?? null,
    commit_refs: row.commit_refs ?? null,
    posted_at: row.posted_at ?? null,
    created_at: String(row.created_at)
  };

  return (
    <Shell title={post.title} subtitle={`Platform: ${post.platform}`}>
      <div className="space-y-6">
        <Link 
          href="/apps/promo-kit"
          className="inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Back to all posts
        </Link>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border ${
          post.status === 'posted' 
            ? 'bg-green-50 border-green-200' 
            : post.status === 'ready'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-zinc-50 border-zinc-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                post.status === 'posted' 
                  ? 'text-green-800' 
                  : post.status === 'ready'
                  ? 'text-amber-800'
                  : 'text-zinc-700'
              }`}>
                Status: <span className="capitalize">{post.status}</span>
                {post.posted_at && ` • Posted ${new Date(post.posted_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              {post.status !== 'posted' ? (
                <form action={markAsPosted}>
                  <input type="hidden" name="id" value={post.id} />
                  <Button type="submit" variant="primary">Mark as Posted</Button>
                </form>
              ) : (
                <form action={markAsDraft}>
                  <input type="hidden" name="id" value={post.id} />
                  <Button type="submit" variant="secondary">Reset to Draft</Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <Card>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">Post Content</h2>
          <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans bg-zinc-50 rounded-lg p-4">
            {post.content}
          </pre>
        </Card>

        {/* Image Section */}
        {post.image_prompt && (
          <Card>
            <h2 className="text-sm font-medium text-zinc-700 mb-2">📸 Image Suggestion</h2>
            <p className="text-sm text-zinc-600 mb-4">{post.image_prompt}</p>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-800">
                💡 Take a screenshot or generate an image matching this description.
                Avoid sharing personal data, credentials, or sensitive information.
              </p>
            </div>
          </Card>
        )}

        {/* Commit References */}
        {post.commit_refs && (
          <Card>
            <h2 className="text-sm font-medium text-zinc-700 mb-2">🔗 Commit References</h2>
            <pre className="text-xs text-zinc-600 whitespace-pre-wrap">{post.commit_refs}</pre>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-red-200">
          <h2 className="text-sm font-medium text-red-700 mb-2">Danger Zone</h2>
          <form action={deletePost} className="flex items-center justify-between">
            <input type="hidden" name="id" value={post.id} />
            <p className="text-xs text-zinc-600">Permanently delete this post</p>
            <Button type="submit" variant="danger">Delete</Button>
          </form>
        </Card>
      </div>
    </Shell>
  );
}

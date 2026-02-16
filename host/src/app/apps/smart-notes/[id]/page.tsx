import { Button, Card, Input, Label, LinkA, Shell, Textarea } from '@/components/Shell';

type Note = { id: number; title: string | null; body: string | null; created_at: string; updated_at?: string | null };

async function fetchNote(id: string) {
  const res = await fetch(`http://localhost:3000/api/apps/smart-notes/notes/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; note: Note };
}

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchNote(id);
  const n = data.note;

  return (
    <Shell title={n.title?.trim() ? n.title : 'Untitled note'} subtitle="Edit your note">
      <div className="flex items-center justify-between">
        <LinkA href="/apps/smart-notes">← back</LinkA>
        <div className="text-xs text-zinc-500">#{n.id}</div>
      </div>

      <Card>
        <form action={`/api/apps/smart-notes/notes/${n.id}/update`} method="post" className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input name="title" defaultValue={n.title ?? ''} placeholder="Title" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea name="body" defaultValue={n.body ?? ''} rows={10} placeholder="Write…" />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit">Save</Button>
            <LinkA href="/apps/smart-notes">Cancel</LinkA>
          </div>
          <p className="text-xs text-zinc-500">
            Created: {n.created_at}
            {n.updated_at ? ` · Updated: ${n.updated_at}` : ''}
          </p>
        </form>

        <form action={`/api/apps/smart-notes/notes/${n.id}/delete`} method="post" className="mt-4">
          <Button type="submit" variant="danger">Delete</Button>
        </form>
      </Card>
    </Shell>
  );
}

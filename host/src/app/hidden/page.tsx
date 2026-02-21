import { Shell, Card, Button, LinkA } from '@/components/Shell';
import { listHiddenApps } from '@/lib/registry';
import { HiddenAppGrid } from './HiddenAppGrid';

export const runtime = 'nodejs';

export default async function HiddenPage() {
  const hiddenApps = await listHiddenApps();

  return (
    <Shell title="Hidden Apps" subtitle="Apps you've hidden from the home screen">
      {hiddenApps.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">👀</div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">No hidden apps</h2>
          <p className="text-zinc-600 mb-6">
            You haven't hidden any apps yet. Apps you hide will appear here.
          </p>
          <LinkA href="/">Back to Home</LinkA>
        </Card>
      ) : (
        <>
          <HiddenAppGrid apps={hiddenApps} />
          <div className="mt-8 flex justify-center">
            <LinkA href="/">← Back to Home</LinkA>
          </div>
        </>
      )}
    </Shell>
  );
}

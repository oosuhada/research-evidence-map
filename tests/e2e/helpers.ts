import type { APIRequestContext } from '@playwright/test';

export const API = 'http://127.0.0.1:8001/api';

export async function seedWorkspace(request: APIRequestContext, options: { evidenceCount?: number; opportunity?: boolean } = {}) {
  const evidenceCount = options.evidenceCount ?? 3;
  const workspaceResponse = await request.post(`${API}/workspaces`, {
    data: { name: `Playwright field ${Date.now()}`, description: 'Browser acceptance fixture for deep links and mobile workflow.' },
  });
  if (!workspaceResponse.ok()) throw new Error(await workspaceResponse.text());
  const workspace = await workspaceResponse.json();
  const documents = Array.from({ length: evidenceCount }, (_, index) => ({
    name: `interview-${index + 1}.md`,
    source_type: 'interview',
    participant: `P-${index + 1}`,
    channel: index % 2 ? 'Meet' : 'Zoom',
    created_date: `2026-08-${String(10 + (index % 14)).padStart(2, '0')}T10:00:00Z`,
    detected_encoding: 'utf-8',
    content: index % 4 === 0
      ? `Interview ${index + 1}: I need exact source evidence because trust drops when a recommendation cannot be traced.`
      : index % 4 === 1
        ? `Interview ${index + 1}: The workflow is slow and I lose time rebuilding context around the decision.`
        : index % 4 === 2
          ? `Interview ${index + 1}: I want evidence grouped around the decision I need to make this week.`
          : `Interview ${index + 1}: However, showing every citation all the time can distract routine work.`,
  }));
  const importedResponse = await request.post(`${API}/workspaces/${workspace.id}/sources`, { data: { documents, confirmed_sensitive_data: false } });
  if (!importedResponse.ok()) throw new Error(await importedResponse.text());
  const imported = await importedResponse.json();
  const analysisResponse = await request.post(`${API}/workspaces/${workspace.id}/analysis`, {
    data: { source_document_ids: imported.sources.map((source: { id: string }) => source.id) },
  });
  if (!analysisResponse.ok()) throw new Error(await analysisResponse.text());
  let detail = await (await request.get(`${API}/workspaces/${workspace.id}`)).json();
  let opportunity = null;
  if (options.opportunity && detail.evidence.length) {
    const opportunityResponse = await request.post(`${API}/workspaces/${workspace.id}/opportunities`, {
      data: {
        title: 'Evidence on demand',
        body: 'Reveal exact evidence at the point a decision is challenged.',
        evidence_item_ids: detail.evidence.slice(0, 2).map((item: { id: string }) => item.id),
      },
    });
    opportunity = await opportunityResponse.json();
    await request.post(`${API}/workspaces/${workspace.id}/opportunities/${opportunity.id}/challenge`);
    detail = await (await request.get(`${API}/workspaces/${workspace.id}`)).json();
  }
  return { workspace, detail, opportunity };
}

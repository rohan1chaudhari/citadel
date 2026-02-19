// External projects that have scrum boards but aren't citadel apps
export type ExternalProject = {
  id: string;
  name: string;
  description?: string;
  repoUrl?: string;
  liveUrl?: string;
};

export const externalProjects: ExternalProject[] = [
  {
    id: 'personal-website',
    name: 'Personal Website',
    description: 'Static site hosted on GitHub Pages (rohanchaudhari.fr)',
    repoUrl: 'https://github.com/rohan1chaudhari/personal-static-website',
    liveUrl: 'https://rohanchaudhari.fr',
  },
];

export function getAllBoardIds(): string[] {
  return ['citadel', ...externalProjects.map(p => p.id)];
}

export function isExternalProject(id: string): boolean {
  return externalProjects.some(p => p.id === id);
}

export function getExternalProject(id: string): ExternalProject | undefined {
  return externalProjects.find(p => p.id === id);
}

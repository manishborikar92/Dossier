// Library-wide numbers used by the dashboard and sidebar.
export function libraryStats(data) {
  const active = data.projects.filter((p) => p.visible !== false);
  const bullets = [...data.experience.flatMap((e) => e.bullets), ...active.flatMap((p) => p.bullets)];
  const count = (s) => bullets.filter((b) => b.status === s).length;
  return { total: bullets.length, confident: count('confident'), review: count('prep'), excluded: count('exclude'), activeProjects: active.length };
}

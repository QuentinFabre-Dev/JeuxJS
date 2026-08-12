const SEVERITIES = ["critique", "majeur", "mineur", "info"];
const SEVERITY_LABEL = {
  critique: "🔴 Critique",
  majeur: "🟠 Majeur",
  mineur: "🟡 Mineur",
  info: "🔵 Info",
};

export function countBySeverity(results) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const result of results) {
    for (const issue of result.problemes) counts[issue.gravite]++;
  }
  return counts;
}

function severityRank(gravite) {
  return SEVERITIES.indexOf(gravite);
}

export function allIssues(results) {
  return results
    .flatMap((r) => r.problemes.map((p) => ({ ...p, file: r.path })))
    .sort((a, b) => severityRank(a.gravite) - severityRank(b.gravite) || a.file.localeCompare(b.file));
}

export function buildMarkdown(report) {
  const { meta, results, synthesis, errors } = report;
  const counts = countBySeverity(results);
  const lines = [];

  lines.push(`# Rapport de QA — ${meta.target}`, "");
  lines.push(
    `- **Date** : ${new Date(meta.startedAt).toLocaleString("fr-FR")}`,
    `- **Modèle** : \`${meta.model}\` via \`${meta.host}\``,
    `- **Fichiers analysés** : ${results.length}`,
    `- **Durée** : ${Math.round(meta.durationMs / 1000)} s`,
    "",
  );

  lines.push(
    "| Critique | Majeur | Mineur | Info |",
    "| --- | --- | --- | --- |",
    `| ${counts.critique} | ${counts.majeur} | ${counts.mineur} | ${counts.info} |`,
    "",
  );

  if (synthesis) {
    lines.push("## Synthèse", "");
    lines.push(`**Verdict : ${synthesis.verdict} — score global ${synthesis.score_global}/100**`, "");
    lines.push(synthesis.synthese, "");
    if (synthesis.risques_majeurs?.length) {
      lines.push("### Risques majeurs", "");
      for (const risk of synthesis.risques_majeurs) lines.push(`- ${risk}`);
      lines.push("");
    }
    if (synthesis.plan_action?.length) {
      lines.push("### Plan d'action", "");
      for (const step of synthesis.plan_action) {
        const files = step.fichiers?.length ? ` — _${step.fichiers.join(", ")}_` : "";
        lines.push(`${step.priorite}. ${step.action}${files}`);
      }
      lines.push("");
    }
  }

  const issues = allIssues(results);
  lines.push("## Problèmes relevés", "");
  if (!issues.length) {
    lines.push("Aucun problème relevé.", "");
  } else {
    for (const issue of issues) {
      const where = issue.ligne ? `${issue.file}:${issue.ligne}` : issue.file;
      lines.push(`### ${SEVERITY_LABEL[issue.gravite]} — ${issue.titre}`, "");
      lines.push(`\`${where}\``, "");
      lines.push(issue.description, "");
      lines.push(`**Correction proposée** : ${issue.correction}`, "");
    }
  }

  lines.push("## Détail par fichier", "");
  for (const result of results) {
    lines.push(`### \`${result.path}\` — ${result.score}/100`, "");
    lines.push(result.resume, "");
    if (result.points_forts?.length) {
      lines.push("Points forts :", "");
      for (const strong of result.points_forts) lines.push(`- ${strong}`);
      lines.push("");
    }
    lines.push(
      result.problemes.length
        ? `${result.problemes.length} problème(s) — voir la section ci-dessus.`
        : "Aucun problème relevé.",
      "",
    );
  }

  if (errors.length) {
    lines.push("## Fichiers non analysés", "");
    for (const err of errors) lines.push(`- \`${err.path}\` : ${err.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function buildHtml(report) {
  const { meta, results, synthesis } = report;
  const counts = countBySeverity(results);
  const issues = allIssues(results);

  const issuesHtml =
    issues
      .map(
        (issue) => `<article class="issue ${issue.gravite}">
  <h3>${escapeHtml(issue.titre)}</h3>
  <p class="where"><span class="badge ${issue.gravite}">${issue.gravite}</span>
    <code>${escapeHtml(issue.ligne ? `${issue.file}:${issue.ligne}` : issue.file)}</code></p>
  <p>${escapeHtml(issue.description)}</p>
  <p class="fix"><strong>Correction :</strong> ${escapeHtml(issue.correction)}</p>
</article>`,
      )
      .join("\n") || "<p>Aucun problème relevé.</p>";

  const filesHtml = results
    .map(
      (r) => `<tr><td><code>${escapeHtml(r.path)}</code></td><td>${r.score}</td>
      <td>${r.problemes.length}</td><td>${escapeHtml(r.resume)}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport QA — ${escapeHtml(meta.target)}</title>
<style>
  :root { color-scheme: light dark; --bg:#ffffff; --fg:#1a1a1a; --muted:#5b5b5b; --card:#f6f6f7; --border:#e0e0e2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16171a; --fg:#ececf1; --muted:#a0a0aa; --card:#202126; --border:#33343a; }
  }
  body { margin:0; padding:2rem 1.25rem; background:var(--bg); color:var(--fg);
         font:16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { margin-top:0; } h2 { margin-top:2.5rem; border-bottom:1px solid var(--border); padding-bottom:.3rem; }
  .meta { color:var(--muted); font-size:.9rem; }
  .counts { display:flex; gap:.75rem; flex-wrap:wrap; margin:1.5rem 0; }
  .count { flex:1 1 8rem; background:var(--card); border:1px solid var(--border);
           border-radius:.6rem; padding:.75rem 1rem; }
  .count b { display:block; font-size:1.8rem; }
  .issue { background:var(--card); border:1px solid var(--border); border-left:4px solid var(--muted);
           border-radius:.5rem; padding:.75rem 1rem; margin:1rem 0; }
  .issue.critique { border-left-color:#e5484d; } .issue.majeur { border-left-color:#f76b15; }
  .issue.mineur { border-left-color:#ffb224; } .issue.info { border-left-color:#3b82f6; }
  .issue h3 { margin:.2rem 0 .5rem; }
  .badge { text-transform:uppercase; font-size:.7rem; letter-spacing:.05em; padding:.1rem .45rem;
           border-radius:.3rem; background:var(--border); }
  .where { color:var(--muted); font-size:.9rem; }
  table { width:100%; border-collapse:collapse; display:block; overflow-x:auto; }
  th, td { text-align:left; padding:.5rem .6rem; border-bottom:1px solid var(--border); vertical-align:top; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.9em; }
</style>
</head>
<body>
<main>
  <h1>Rapport de QA — ${escapeHtml(meta.target)}</h1>
  <p class="meta">${new Date(meta.startedAt).toLocaleString("fr-FR")} · modèle
     <code>${escapeHtml(meta.model)}</code> · ${results.length} fichiers ·
     ${Math.round(meta.durationMs / 1000)} s</p>

  <div class="counts">
    <div class="count"><b>${counts.critique}</b> critiques</div>
    <div class="count"><b>${counts.majeur}</b> majeurs</div>
    <div class="count"><b>${counts.mineur}</b> mineurs</div>
    <div class="count"><b>${counts.info}</b> infos</div>
  </div>

  ${
    synthesis
      ? `<h2>Synthèse</h2>
  <p><strong>Verdict : ${escapeHtml(synthesis.verdict)} — ${synthesis.score_global}/100</strong></p>
  <p>${escapeHtml(synthesis.synthese)}</p>
  <ul>${(synthesis.risques_majeurs ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
  <ol>${(synthesis.plan_action ?? [])
    .map((s) => `<li>${escapeHtml(s.action)} <em>${escapeHtml((s.fichiers ?? []).join(", "))}</em></li>`)
    .join("")}</ol>`
      : ""
  }

  <h2>Problèmes relevés</h2>
  ${issuesHtml}

  <h2>Détail par fichier</h2>
  <table>
    <thead><tr><th>Fichier</th><th>Score</th><th>Problèmes</th><th>Résumé</th></tr></thead>
    <tbody>${filesHtml}</tbody>
  </table>
</main>
</body>
</html>`;
}

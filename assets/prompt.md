I'm uploading course materials (chapters, lecture notes, exercise sheets/TDs) for [SUBJECT — fill this in, e.g. "Probability theory", "Organic chemistry", "Operating systems"]. Build me a single self-contained interactive HTML revision file with the same structure and aesthetic as the algebra revision file you made me previously.

## STRUCTURE

Tab navigation at the top with Roman numerals. One tab per chapter detected in my uploads, then two synthesis tabs:

- One tab per chapter (I, II, III, ...) with all the content from that chapter
- A "Méthodes" tab (M): a cookbook of "How do I answer this kind of question?" cards, one per common question type seen in the TDs/exercises
- A "Synthèse" tab (S): how the chapters connect, patterns of exercises that recur, a conceptual diagram, and a final check-list before exam

## CONTENT RULES

- Match the source language of the materials (if the course is in French, write in French; if English, English, etc.)
- Each chapter tab should cover ALL key definitions, theorems, propositions, and properties from that chapter
- Use boxes with colored left borders to separate: definitions (teal), theorems (burgundy), propositions (gold), remarks (gray), methods (burgundy gradient)
- Reference specific TD/exercise numbers in the Methods cards when relevant ("Apparu dans TD3 ex.2")
- Use KaTeX for math notation if the subject is mathematical; otherwise use clean typography
- Include "pièges" (gotchas) and "astuces" (tips) in warning boxes

## INTERACTIVE VISUALIZATIONS

Look at the subject matter and CHOOSE 2-4 visualizations that genuinely help understanding. Don't force them; pick what actually clarifies the hardest concepts. Examples by domain:

- Math/geometry: draggable vectors, step-by-step algorithm walkthroughs, parameter sliders
- Physics: force diagrams, oscillations, field visualizations
- Chemistry: molecule structures, reaction mechanisms, orbital shapes
- CS/algorithms: step-by-step execution traces, data structure animations, complexity comparisons
- Statistics/probability: distribution plots with parameter controls, sampling demos
- Biology: pathway diagrams, cell processes, phylogenetic trees
- Economics: supply/demand curves with shock sliders, game theory matrices
- Languages/linguistics: tree diagrams, conjugation tables with toggles

Each visualization should:

- Use inline SVG with vanilla JS (no external libs beyond KaTeX and Google Fonts)
- Have drag-and-drop or sliders or step controls where it makes sense
- Show real-time numerical/textual feedback in a side panel
- Include a legend explaining colors/symbols

## DESIGN (keep the same aesthetic)

- Warm parchment background (#F4EFE4) with subtle SVG noise overlay
- Color palette: deep ink #1F1A14, burgundy #7B2D26, teal #2C5664, gold #B8924A, highlight #F7E8B8
- Typography: 'Instrument Serif' (italic for h1/h2/h3 display), 'Newsreader' for body, 'JetBrains Mono' for code/labels/UI
- Subtle paper grain, ornamental ◆ ◆ ◆ dividers, italic editorial subtitles
- Header with school/course eyebrow tag (uppercase mono), large italic title with one word in burgundy italic, italic subtitle
- Tab bar with Roman numeral prefixes in mono font
- Chapter sections numbered §1.1, §1.2, etc. in small caps mono
- Bold maximalism is wrong here — this is refined, scholarly, textbook-meets-modern-interactive

## METHODS TAB (cookbook cards)

Each card has:

- An italic question like "Comment montrer que X est Y ?" prefixed with a small "Q." mono label
- Numbered procedure steps (use counter-reset CSS, not <ol> default styling — leading zeros with mono font)
- A highlighted "✦ Astuce" tip box at the bottom referencing a specific exercise

Generate one card per distinct question pattern you find in the TDs/exercises.

## SYNTHÈSE TAB

- "Flow grid" with one node per chapter, showing the conceptual content of each as pills
- 4 "ponts" (bridges) explaining how chapter X connects to chapter Y, in a 2-column grid
- "Pattern cards" — one per recurring exercise type, with a step-by-step chain and exercise references
- A full SVG concept map showing all chapters and the central synthesis theorem/concept linking them
- A final key-value checklist of: "À savoir énoncer", "À savoir faire", "Formules clés", "Pièges classiques"

## OUTPUT

One HTML file. Self-contained. Place all CSS in <style> and JS in <script>. Use CDN for KaTeX (jsdelivr) and Google Fonts. Put the file in /mnt/user-data/outputs/ and use present_files to share it.

Before writing the file, read all my uploaded materials carefully and identify:

1. The list of chapters
2. The key theorems and methods in each
3. The recurring exercise patterns
4. Which 2-4 concepts would most benefit from interactive visualization
5. The bridges and synthesis themes between chapters

Don't ask me clarifying questions — work from the materials. If something is ambiguous, make a reasonable choice and proceed.

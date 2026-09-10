// Ultimate Guitar can't be scraped, so the chord-chart link is always a
// Google search built at render time unless a manual override is set.
export function chordChartUrl(song) {
  if (song.chord_chart_url) return song.chord_chart_url;
  const q = `${song.title} ${song.artist} "chords"`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

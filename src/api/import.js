import { get, post } from './client';

export const importCsv          = (body)    => post('/api/import/csv', body);
export const spotifySearch      = (q)       => get(`/api/import/spotify/search?q=${encodeURIComponent(q)}`);
export const spotifyConfirm     = (tracks)  => post('/api/import/spotify/confirm', { tracks });

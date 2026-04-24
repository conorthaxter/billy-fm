import { get, post, patch, del } from './client';

export const getLibrary         = ()           => get('/api/library');
export const addToLibrary       = (songId, body = {}) => post(`/api/library/${songId}`, body);
export const updateLibraryEntry = (songId, body) => patch(`/api/library/${songId}`, body);
export const removeFromLibrary  = (songId)     => del(`/api/library/${songId}`);
export const createPrivateSong  = (body)       => post('/api/library/private', body);
export const importAllSongs     = ()           => post('/api/library/import-all');

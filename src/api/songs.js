import { get, post, patch } from './client';

/**
 * @param {{ search?, genre?, era?, key?, page?, limit? }} params
 */
export const listSongs  = (params = {}) => get('/api/songs?' + new URLSearchParams(params));
export const getSong    = (id)          => get(`/api/songs/${id}`);
export const createSong = (body)        => post('/api/songs', body);
export const updateSong = (id, body)    => patch(`/api/songs/${id}`, body);

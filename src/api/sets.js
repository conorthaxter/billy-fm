import { get, post, put, patch, del } from './client';

const base = (slug) => `/api/sets/${slug}`;

export const verifySet     = (slug, password)          => post(`${base(slug)}/verify`, { password });
export const getSet        = (slug)                    => get(base(slug));
export const addSong       = (slug, song_id)           => post(`${base(slug)}/songs`, { song_id });
export const removeSong    = (slug, songId)            => del(`${base(slug)}/songs/${songId}`);
export const reorderSet    = (slug, songs)             => put(`${base(slug)}/order`, { songs });
export const patchSong     = (slug, songId, body)      => patch(`${base(slug)}/songs/${songId}`, body);
export const submitRequest = (slug, request_text, requester_note = '') =>
  post(`${base(slug)}/requests`, { request_text, requester_note });
export const submitSet     = (slug)                    => post(`${base(slug)}/submit`, {});
export const getSnapshot   = (slug, submissionId)      => get(`${base(slug)}/snapshot/${submissionId}`);

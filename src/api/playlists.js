import { get, post, patch, put, del } from './client';

export const listPlaylists    = ()            => get('/api/playlists');
export const createPlaylist   = (body)        => post('/api/playlists', body);
export const getPlaylist      = (id)          => get(`/api/playlists/${id}`);
export const updatePlaylist   = (id, body)    => patch(`/api/playlists/${id}`, body);
export const deletePlaylist   = (id)          => del(`/api/playlists/${id}`);

/** Full replace of songs in a playlist. songs = [{ song_id, position, notes? }] */
export const setPlaylistSongs = (id, songs)   => put(`/api/playlists/${id}/songs`, { songs });

/** Update is_played / notes for one song in a playlist */
export const updatePlaylistSong = (id, songId, body) =>
  patch(`/api/playlists/${id}/songs/${songId}`, body);

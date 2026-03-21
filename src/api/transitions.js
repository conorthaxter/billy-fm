import { get, post, del } from './client';

export const getTransitions    = (songId)         => get(`/api/library/${songId}/transitions`);
export const createTransition  = (songId, body)   => post(`/api/library/${songId}/transitions`, body);
export const deleteTransition  = (id)             => del(`/api/transitions/${id}`);

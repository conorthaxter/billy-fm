import type { IRequest } from 'itty-router';
import type { Env } from '../index';
import { getSongbook } from './songbook';

// ---------------------------------------------------------------------------
// GET /api/repertoire/:userId
// Same logic as /api/songbook/:userId — separate route for conor.bio modal.
// Params: request.params.userId → re-mapped to match getSongbook's expectation.
// ---------------------------------------------------------------------------

export async function getRepertoire(request: IRequest, env: Env): Promise<Response> {
  // getSongbook reads request.params.userId — params already match
  return getSongbook(request, env);
}

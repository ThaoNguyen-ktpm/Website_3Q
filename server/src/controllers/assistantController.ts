import type { RequestHandler } from 'express';
import { chat } from '../services/assistant/graph.js';

export const assistantChat: RequestHandler = async (request, response, next) => {
  try { response.json(await chat(request.body, response.locals.user.permissions)); }
  catch (error) { next(error); }
};

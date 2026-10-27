import type { RequestHandler } from 'express';
import { documentStore } from '../models/documentStore.js';
import { ingestDocument, deleteDocument } from '../services/documentIngestService.js';
import { askDocuments } from '../services/documentQaGraph.js';

export const listDocuments: RequestHandler = async (_request, response, next) => {
  try { response.json({ documents: await documentStore.list() }); } catch (error) { next(error); }
};
export const uploadDocument: RequestHandler = async (request, response, next) => {
  try { response.status(201).json({ document: await ingestDocument(request.body, request.get('X-File-Name'), response.locals.user, request.ip) }); }
  catch (error) { next(error); }
};
export const removeDocument: RequestHandler = async (request, response, next) => {
  try { await deleteDocument(request.params.id, response.locals.user, request.ip); response.status(204).end(); }
  catch (error) { next(error); }
};
export const askDocumentQuestion: RequestHandler = async (request, response, next) => {
  try { response.json(await askDocuments(request.body)); } catch (error) { next(error); }
};
